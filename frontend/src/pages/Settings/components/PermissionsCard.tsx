import React, { useEffect, useMemo, useState } from 'react';
import { SettingsSection } from './SettingsSection';
import { Button } from '../../../components/atoms';
import { useI18n } from '../../../i18n/useI18n';
import { useToast } from '../../../hooks/useToast';
import { api } from '../../../lib/ipc';
import {
  usePermissions,
  type PermissionDomain,
  type PermissionId,
  type PermissionManifest,
  type PermissionMatrix,
  type StaffRole,
} from '../../../auth';
import { staffRoleLabel } from '../../Staff/staffRoles';
import type { TranslationKey } from '../../../i18n/types';

/** Domain order, so the groups read from the floor inwards. */
const DOMAIN_ORDER: PermissionDomain[] = [
  'service', 'kitchen', 'catalogue', 'back-office', 'money', 'administration',
];

/**
 * The role → permission matrix.
 *
 * These permissions are enforced in the main process against a session it
 * created by verifying a PIN, so this screen edits real access rather than
 * what the renderer chooses to show. Two rules are visible here because they
 * are the ones that keep the screen safe to hand to an outlet's own admin:
 * admin is not editable, and the permissions that would let their holder
 * become an admin cannot be granted to any other role.
 */
export const PermissionsCard: React.FC = () => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const { refresh: refreshMine } = usePermissions();

  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null);
  const [role, setRole] = useState<StaffRole>('manager');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void api.permissions.get().then((res) => {
      if (active && res.success && res.data) { setMatrix(res.data); }
    }).catch(console.error);
    return () => { active = false; };
  }, []);

  const row = matrix?.roles.find(r => r.role === role);
  const granted = useMemo(() => new Set(row?.granted ?? []), [row]);

  const byDomain = useMemo(() => {
    const groups = new Map<PermissionDomain, PermissionManifest[]>();
    for (const domain of DOMAIN_ORDER) { groups.set(domain, []); }
    for (const permission of matrix?.permissions ?? []) {
      groups.get(permission.domain)?.push(permission);
    }
    return groups;
  }, [matrix]);

  const toggle = async (permission: PermissionId, next: boolean) => {
    setSaving(true);
    try {
      const res = await api.permissions.set({ role, permission, granted: next });
      if (res.success && res.data) {
        setMatrix(res.data);
        // The editing admin may have just changed their own role's rules —
        // not their own, since admin is fixed, but a manager editing is
        // impossible, so this keeps the shell honest either way.
        await refreshMine();
        showToast({ message: t('settings.permissionSaved'), variant: 'success' });
      }
    } finally {
      setSaving(false);
    }
  };

  const restoreDefaults = async () => {
    setSaving(true);
    try {
      const res = await api.permissions.resetRole({ role });
      if (res.success && res.data) {
        setMatrix(res.data);
        await refreshMine();
        showToast({ message: t('settings.roleReset'), variant: 'success' });
      }
    } finally {
      setSaving(false);
    }
  };

  if (!matrix) {
    return (
      <SettingsSection title={t('settings.permissions')}>
        <div className="h-8 flex items-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand" />
        </div>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title={t('settings.permissions')}
      description={t('settings.permissionsHint')}
    >
      <p className="text-xs text-subtle">{t('settings.permissionsEnforced')}</p>

      {/* ── Role picker ───────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t('settings.permissions')}
      >
        {matrix.roles.map(candidate => (
          <button
            key={candidate.role}
            type="button"
            aria-pressed={role === candidate.role}
            onClick={() => { setRole(candidate.role); }}
            className={`px-3 py-2 rounded-control border text-sm font-medium transition-colors ${
              role === candidate.role
                ? 'border-brand bg-brand-subtle text-brand'
                : 'border-line text-muted hover:bg-surface-sunken'
            }`}
          >
            {staffRoleLabel(candidate.role, t)}
            {candidate.customised && (
              <span className="ms-1.5 text-xs font-normal opacity-70">•</span>
            )}
          </button>
        ))}
      </div>

      {row && !row.editable ? (
        <p className="text-sm text-muted">{t('settings.adminAllAccess')}</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs text-subtle">
              {row?.customised ? t('settings.roleCustomised') : t('settings.roleDefaults')}
            </span>
            {row?.customised === true && (
              <Button
                variant="secondary"
                disabled={saving}
                onClick={() => { void restoreDefaults(); }}
              >
                {t('action.resetRole')}
              </Button>
            )}
          </div>

          <div className="space-y-5">
            {DOMAIN_ORDER.map((domain) => {
              const permissions = byDomain.get(domain) ?? [];
              if (permissions.length === 0) { return null; }

              return (
                <fieldset key={domain}>
                  <legend className="text-sm font-medium text-muted mb-2">
                    {t(`permDomain.${domain}` as TranslationKey)}
                  </legend>

                  <div className="space-y-1">
                    {permissions.map((permission) => {
                      const adminOnly = permission.adminOnly === true;

                      return (
                        <label
                          key={permission.id}
                          className={`flex items-start gap-3 p-2 rounded-control ${
                            adminOnly ? 'opacity-60' : 'hover:bg-surface-sunken cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 accent-[var(--kp-brand)]"
                            checked={granted.has(permission.id)}
                            // Admin-only permissions are shown rather than
                            // hidden, so it is clear they exist and why this
                            // role cannot have them.
                            disabled={adminOnly || saving}
                            onChange={(e) => { void toggle(permission.id, e.target.checked); }}
                          />
                          <span className="min-w-0">
                            <span className="block text-sm text-body">
                              {t(permission.nameKey as TranslationKey)}
                              {adminOnly && (
                                <span className="ms-2 text-xs text-warning">
                                  {t('settings.adminOnlyPermission')}
                                </span>
                              )}
                            </span>
                            <span className="block text-xs text-subtle">
                              {adminOnly
                                ? t('settings.adminOnlyHint')
                                : t(permission.descriptionKey as TranslationKey)}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
          </div>
        </>
      )}
    </SettingsSection>
  );
};
