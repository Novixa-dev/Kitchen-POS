import { Input } from '../../../components/atoms';
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/ipc';
import { SvgIcon } from '../../../components/atoms/svg-sprite-loader';
import { useI18n } from '../../../i18n/useI18n';

import { MenuItem } from '../../../types/models';

interface Props {
  menuId: number | null;
  onAddItem: (item: MenuItem) => void;
}

const MenuPanel: React.FC<Props> = ({ menuId, onAddItem }) => {
  const { t, formatCurrency } = useI18n();

  // The loaded menu id travels with its items, so switching menus shows an
  // empty grid immediately instead of briefly showing the previous menu —
  // and nothing has to be cleared from inside the effect.
  const [loaded, setLoaded] = useState<{ menuId: number; items: MenuItem[] } | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!menuId) { return; }

    let active = true;
    api.menu.getAll(menuId).then((res) => {
      if (!active || !res.success || !res.data) { return; }
      setLoaded({ menuId, items: res.data.flatMap((cat) => cat.items) });
    }).catch(console.error);

    return () => { active = false; };
  }, [menuId]);

  const items = useMemo(
    () => (loaded?.menuId === menuId ? loaded.items : []),
    [loaded, menuId],
  );

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    if (!needle) { return items; }
    // `toLocaleLowerCase` rather than `toLowerCase`: item names are routinely
    // mixed Arabic and Latin, and locale-aware casing handles both.
    return items.filter((item) => item.name.toLocaleLowerCase().includes(needle));
  }, [items, search]);

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <Input
          type="search"
          placeholder={t('menu.searchPlaceholder')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); }}
        />
      </div>

      {filteredItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-subtle gap-2">
          <SvgIcon name="search" width="32" height="32" aria-hidden />
          <p className="text-sm">{search ? t('state.noResults') : t('menu.noItems')}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max pb-10">
          {filteredItems.map((item) => (
            // A real button: adding items is the single most repeated action
            // in the app and must work from the keyboard.
            <button
              key={item.id}
              type="button"
              onClick={() => { onAddItem(item); }}
              className="group hover-lift flex flex-col justify-between overflow-hidden relative rounded-card border border-line bg-surface-raised shadow-card text-start transition-all duration-300 hover:shadow-raised hover:border-brand/40 disabled:opacity-50"
              disabled={item.is_available === 0}
            >
              {item.image_url ? (
                <div className="w-full h-36 bg-surface-sunken relative overflow-hidden">
                  <img
                    // Images are served through the confined `local://` handler
                    // rather than `file://`, which the CSP blocks.
                    src={item.image_url.replace('file://', 'local://')}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span
                    className={`absolute top-2 end-2 w-3.5 h-3.5 rounded-full border-2 border-white shadow z-10 ${item.is_veg ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    aria-label={item.is_veg ? t('menu.isVeg') : undefined}
                  />
                </div>
              ) : (
                <div className="pt-5 px-5 flex items-start gap-2 mb-2">
                  <span
                    className={`w-3.5 h-3.5 rounded-full mt-1 shrink-0 border-2 border-white shadow-sm ${item.is_veg ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    aria-label={item.is_veg ? t('menu.isVeg') : undefined}
                  />
                  <h3 className="font-bold flex-1 text-sm md:text-base leading-tight text-body line-clamp-2">
                    {item.name}
                  </h3>
                </div>
              )}

              <div className={`p-5 flex flex-col w-full ${item.image_url ? 'pt-3' : 'pt-0'}`}>
                {item.image_url && (
                  <h3 className="font-bold text-sm md:text-base leading-tight mb-1 text-body line-clamp-2">
                    {item.name}
                  </h3>
                )}
                <div className="flex justify-between items-end gap-2 mt-auto">
                  <p className="text-brand font-bold text-lg tabular">{formatCurrency(item.price)}</p>
                  <span className="bg-surface-sunken text-subtle rounded-full p-1.5 opacity-0 group-hover:opacity-100 group-hover:bg-brand-subtle group-hover:text-brand transition-all">
                    <SvgIcon name="plus" width="14" height="14" aria-hidden />
                  </span>
                </div>
                {item.is_available === 0 && (
                  <span className="mt-2 text-xs font-semibold text-danger">{t('menu.unavailable')}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MenuPanel;
