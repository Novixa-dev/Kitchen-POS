import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/ipc';
import { BackButton, Button, Input } from '../../components/atoms';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../i18n/useI18n';

const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t, currency } = useI18n();

  const isNew = id === 'new';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [creditLimit, setCreditLimit] = useState('0');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // `false` once the record is in hand (or immediately, for a new customer).
  const [isLoading, setIsLoading] = useState(!isNew);

  useEffect(() => {
    if (isNew || !id) { return; }

    let active = true;
    api.customers.getById(Number(id))
      .then(res => {
        if (!active) { return; }
        if (res.success && res.data) {
          const c = res.data;
          setName(c.name);
          setPhone(c.phone ?? '');
          setEmail(c.email ?? '');
          setCreditLimit(String(c.credit_limit));
        } else {
          showToast({ message: t('customers.notFound'), variant: 'error' });
          navigate('/customers');
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (active) {
          showToast({ message: t('toast.unexpectedError'), variant: 'error' });
          setIsLoading(false);
        }
      });

    return () => { active = false; };
  }, [id, isNew, navigate, showToast, t]);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError(t('validation.nameRequired'));
      return;
    }

    const limit = Number.parseFloat(creditLimit);
    if (!Number.isFinite(limit) || limit < 0) {
      setError(t('validation.invalidNumber'));
      return;
    }

    setError('');
    setSaving(true);

    const payload = {
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      credit_limit: limit,
    };

    const res = isNew
      ? await api.customers.create(payload)
      : await api.customers.update({ ...payload, id: Number(id) });

    setSaving(false);

    if (res.success) {
      showToast({
        message: t(isNew ? 'customers.created' : 'customers.updated'),
        variant: 'success',
      });
      navigate('/customers');
    } else {
      setError(res.error ?? t('customers.saveFailed'));
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse bg-surface-raised p-6 rounded-card border border-line h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6 flex items-center">
        <BackButton to="/customers" label={t('customers.backToList')} />
      </div>

      <div className="bg-surface-raised rounded-card border border-line shadow-card overflow-hidden">
        <div className="border-b border-line px-6 py-4 bg-surface-muted">
          <h1 className="text-xl font-bold text-body">
            {t(isNew ? 'customers.addCustomer' : 'customers.editCustomer')}
          </h1>
        </div>

        <div className="p-6">
          <form id="customer-form" onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
            {error && (
              <div role="alert" className="p-3 bg-danger-subtle border border-danger/20 text-danger rounded-control text-sm">
                {error}
              </div>
            )}

            <Input
              label={t('customers.customerName')}
              autoFocus
              required
              value={name}
              onChange={(e) => { setName(e.target.value); }}
              placeholder={t('customers.namePlaceholder')}
            />

            <Input
              label={t('label.phone')}
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); }}
              placeholder={t('customers.phonePlaceholder')}
            />

            <Input
              label={t('label.email')}
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); }}
              placeholder={t('customers.emailPlaceholder')}
            />

            <div>
              <Input
                label={`${t('customers.creditLimit')} (${currency.symbol || currency.code})`}
                type="number"
                min="0"
                step="0.01"
                value={creditLimit}
                onChange={(e) => { setCreditLimit(e.target.value); }}
              />
              <p className="text-xs text-subtle mt-1">{t('customers.creditLimitHint')}</p>
            </div>

            <div className="pt-4 flex gap-3 justify-end border-t border-line mt-6">
              <Button type="button" variant="outline" onClick={() => { navigate('/customers'); }}>
                {t('action.cancel')}
              </Button>
              <Button type="submit" variant="primary" isLoading={saving}>
                {t('customers.saveCustomer')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CustomerDetailPage;
