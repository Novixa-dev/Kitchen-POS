import { Button } from '../../../components/atoms';
import React from 'react';
import { SvgIcon } from '../../../components/atoms/svg-sprite-loader';
import { useLocation } from 'react-router-dom';
import { useHeader } from '../../../contexts/HeaderContext';
import { useI18n } from '../../../i18n/useI18n';
import type { TranslationKey } from '../../../i18n/types';
import LocaleSwitcher from './LocaleSwitcher';
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
  isSidebarPermanent: boolean;
  onOpenMobileDrawer: () => void;
}

/**
 * Route → title key.
 *
 * Ordered longest-prefix-first so `/customers/:id` cannot be shadowed by
 * `/customers`.
 */
const TITLE_ROUTES: [prefix: string, key: TranslationKey][] = [
  ['/past-orders', 'page.pastOrders'],
  ['/customers/', 'page.customerDetail'],
  ['/customers', 'page.customers'],
  ['/components', 'page.components'],
  ['/inventory', 'page.inventory'],
  ['/dashboard', 'page.dashboard'],
  ['/expenses', 'page.expenses'],
  ['/settings', 'page.settings'],
  ['/reports', 'page.reports'],
  ['/tables', 'page.tables'],
  ['/order', 'page.order'],
  ['/staff', 'page.staff'],
  ['/menu', 'page.menu'],
  ['/kds', 'page.kds'],
];

function titleKeyFor(pathname: string): TranslationKey {
  return TITLE_ROUTES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? 'page.dashboard';
}

const Header: React.FC<HeaderProps> = ({ isSidebarPermanent, onOpenMobileDrawer }) => {
  const location = useLocation();
  const { title, action } = useHeader();
  const { t } = useI18n();

  // A page may set its own title (e.g. the table being ordered for); otherwise
  // it is derived from the route so it stays translated.
  const pageName = title ?? t(titleKeyFor(location.pathname));

  return (
    <header className="h-[72px] flex items-center px-4 bg-surface border-b border-line shrink-0 shadow-sm z-10 sticky top-0">

      {/* Hamburger — only when the sidebar is not permanently visible */}
      {!isSidebarPermanent && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenMobileDrawer}
          aria-label={t('nav.open')}
          className="me-3 text-muted hover:bg-surface-sunken"
        >
          <SvgIcon name="menu" width="24" height="24" />
        </Button>
      )}

      <div className="flex-1 flex justify-between items-center gap-4 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          {!isSidebarPermanent && (
            <span className="font-bold text-xl text-body hidden sm:block pe-3 border-e border-line">
              {t('app.name')}
            </span>
          )}
          <h1 className="text-xl font-bold text-body truncate">{pageName}</h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {action}
          <ThemeToggle />
          <LocaleSwitcher className="hidden sm:inline-flex" />
        </div>
      </div>
    </header>
  );
};

export default Header;
