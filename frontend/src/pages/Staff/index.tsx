import { Autosearch, Button } from '../../components/atoms';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/ipc';
import { Staff } from '../../types/models';
import { Card } from '../../components/atoms/card';
import StaffModal from './components/StaffModal';
import { useModal } from '../../hooks/useModal';
import { useToast } from '../../hooks/useToast';
import { useHeader } from '../../contexts/HeaderContext';
import { useI18n } from '../../i18n/useI18n';
import { useAuthStore } from '../../store/auth';
import { staffRoleLabel } from './staffRoles';

/** Role accents are literal: they identify the role, not a theme surface. */
const ROLE_CHIP: Partial<Record<string, string>> = {
  admin: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  manager: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  cashier: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  waiter: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  kitchen: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
};

const StaffPage: React.FC = () => {
  const { t } = useI18n();
  const { showModal, hideModal } = useModal();
  const { showToast } = useToast();
  const currentStaff = useAuthStore(state => state.staff);

  const [staffList, setStaffList] = useState<Staff[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchStaff = useCallback(() => {
    return api.staff.getAll().then(res => {
      if (res.success && res.data) {
        setStaffList(res.data.filter(s => s.is_active));
      }
    });
  }, []);

  useEffect(() => {
    fetchStaff().catch(console.error);
  }, [fetchStaff]);

  const handleSaveStaff = useCallback(async (data: Partial<Staff>) => {
    const res = await api.staff.upsert(data);
    if (res.success) {
      showToast({ message: t('staff.saved'), variant: 'success' });
      hideModal();
      await fetchStaff();
    } else {
      // Previously only logged to the console, so a rejected role or PIN made
      // the dialog appear to do nothing.
      showToast({ message: res.error ?? t('staff.saveFailed'), variant: 'error' });
    }
  }, [hideModal, fetchStaff, showToast, t]);

  const handleDelete = (member: Staff) => {
    // Removing the account you are signed in with would lock you out of the
    // app with no way back except the recovery code.
    if (member.id === currentStaff?.id) {
      showToast({ message: t('staff.cannotDeleteSelf'), variant: 'warning' });
      return;
    }

    showModal({
      title: t('staff.removeTitle'),
      content: (
        <div className="space-y-2">
          <p className="text-body font-medium">{t('staff.deleteConfirm', { name: member.name })}</p>
          <p className="text-sm text-muted">{t('staff.removeConfirm')}</p>
        </div>
      ),
      actions: (
        <>
          <Button variant="ghost" onClick={hideModal}>{t('action.cancel')}</Button>
          <Button
            variant="danger"
            onClick={() => {
              hideModal();
              void api.staff.delete({ id: member.id }).then(async (res) => {
                if (res.success) {
                  showToast({ message: t('staff.removed'), variant: 'success' });
                  await fetchStaff();
                } else {
                  showToast({ message: res.error ?? t('staff.removeFailed'), variant: 'error' });
                }
              });
            }}
          >
            {t('action.remove')}
          </Button>
        </>
      ),
    });
  };

  const openStaffModal = useCallback((member: Staff | null) => {
    showModal({
      title: t(member ? 'staff.editStaff' : 'staff.addStaff'),
      content: (
        <StaffModal
          initialData={member}
          onSave={data => { handleSaveStaff(data).catch(console.error); }}
        />
      ),
      actions: (
        <>
          <Button variant="ghost" onClick={hideModal}>{t('action.cancel')}</Button>
          <Button type="submit" form="staff-form" variant="primary">
            {t('staff.saveStaff')}
          </Button>
        </>
      ),
    });
  }, [showModal, hideModal, handleSaveStaff, t]);

  const filteredStaff = useMemo(() => {
    const all = staffList ?? [];
    const needle = searchQuery.trim().toLocaleLowerCase();
    if (!needle) { return all; }
    return all.filter(s =>
      s.name.toLocaleLowerCase().includes(needle) ||
      staffRoleLabel(s.role, t).toLocaleLowerCase().includes(needle),
    );
  }, [staffList, searchQuery, t]);

  const searchOptions = useMemo(
    () => (staffList ?? []).map(s => ({ value: String(s.id), label: s.name })),
    [staffList],
  );

  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader(
      t('page.staff'),
      <div className="flex items-center gap-3">
        <div className="w-64">
          <Autosearch
            placeholder={t('staff.searchPlaceholder')}
            options={searchOptions}
            value={searchQuery}
            onChange={setSearchQuery}
            onSelectOption={(opt) => { setSearchQuery(opt.label); }}
          />
        </div>
        <Button variant="primary" icon="plus" onClick={() => { openStaffModal(null); }}>
          {t('staff.addStaff')}
        </Button>
      </div>,
    );
    return () => { setHeader(null, null); };
  }, [setHeader, searchQuery, searchOptions, openStaffModal, t]);

  return (
    <div className="container-responsive p-6 mx-auto h-full flex flex-col">
      <Card className="flex-1 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-surface-muted border-b border-line sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-semibold text-muted text-start">{t('label.name')}</th>
                <th className="px-6 py-4 font-semibold text-muted text-start">{t('label.role')}</th>
                <th className="px-6 py-4 font-semibold text-muted text-end">{t('label.actions')}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {staffList === null && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-subtle">
                    {t('state.loading')}
                  </td>
                </tr>
              )}

              {staffList !== null && filteredStaff.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-subtle">
                    {t(staffList.length === 0 ? 'staff.empty' : 'staff.noResults')}
                  </td>
                </tr>
              )}

              {filteredStaff.map((member) => (
                <tr key={member.id} className="hover:bg-surface-sunken transition-colors">
                  <td className="px-6 py-4 text-body font-medium">
                    {member.name}
                    {member.id === currentStaff?.id && (
                      <span className="ms-2 text-xs text-subtle">({t('state.active')})</span>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        ROLE_CHIP[member.role] ?? 'bg-surface-sunken text-body'
                      }`}
                    >
                      {staffRoleLabel(member.role, t)}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-brand hover:bg-brand-subtle me-2"
                      onClick={() => { openStaffModal(member); }}
                    >
                      {t('action.edit')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:bg-danger-subtle"
                      onClick={() => { handleDelete(member); }}
                    >
                      {t('action.remove')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default StaffPage;
