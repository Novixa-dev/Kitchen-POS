import React, { useEffect, useState } from 'react';
import { Customer } from '../../types/models';
import { api } from '../../lib/ipc';
import { Button, Input } from '../atoms';
import { useI18n } from '../../i18n/useI18n';

interface CustomerSelectProps {
  selectedCustomer: Customer | null;
  onSelect: (customer: Customer | null) => void;
  placeholder?: string;
  className?: string;
}

/** Below this, a search would match most of the customer list. */
const MIN_QUERY_LENGTH = 2;
/** Debounce so a fast typist does not fire a query per keystroke. */
const DEBOUNCE_MS = 300;

export const CustomerSelect: React.FC<CustomerSelectProps> = ({
  selectedCustomer,
  onSelect,
  placeholder,
  className = '',
}) => {
  const { t, formatCurrency } = useI18n();

  const [searchQuery, setSearchQuery] = useState('');

  // Results carry the query they answered, so the list is *derived* rather
  // than cleared from inside the effect: a stale response for an older query
  // simply stops matching and disappears on its own.
  const [results, setResults] = useState<{ query: string; items: Customer[] } | null>(null);

  const query = searchQuery.trim();
  const searchResults = results?.query === query ? results.items : [];

  useEffect(() => {
    if (query.length < MIN_QUERY_LENGTH) { return; }

    let active = true;
    const timer = setTimeout(() => {
      api.customers.search(query)
        .then(res => {
          if (!active) { return; }
          setResults({ query, items: res.success && res.data ? res.data : [] });
        })
        .catch(console.error);
    }, DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  if (selectedCustomer) {
    return (
      <div className={`bg-surface border border-line rounded-control p-2 text-sm flex justify-between items-center gap-2 ${className}`}>
        <div className="min-w-0">
          <p className="font-bold text-body truncate">{selectedCustomer.name}</p>
          <p className="text-xs text-subtle tabular">
            {t('customers.limitShort')}: {formatCurrency(selectedCustomer.credit_limit)}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => { onSelect(null); }}
          className="h-6 w-6 shrink-0"
          type="button"
          aria-label={t('action.clear')}
        >
          ✕
        </Button>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <Input
        type="search"
        placeholder={placeholder ?? t('customers.searchByNameOrPhone')}
        value={searchQuery}
        onChange={e => { setSearchQuery(e.target.value); }}
        className="w-full text-sm"
      />

      {searchResults.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-surface-raised border border-line rounded-control shadow-overlay max-h-48 overflow-y-auto">
          {searchResults.map(c => (
            <li key={c.id}>
              <button
                type="button"
                className="w-full p-2 border-b border-line last:border-b-0 hover:bg-brand-subtle text-start text-sm"
                onClick={() => {
                  onSelect(c);
                  setSearchQuery('');
                }}
              >
                <span className="block font-bold text-body">{c.name}</span>
                <span className="block text-xs text-subtle tabular">
                  {c.phone ?? t('customers.noPhone')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
