import { Button } from '../../../components/atoms';
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { SvgIcon } from '../../../components/atoms/svg-sprite-loader';
import { useI18n } from '../../../i18n/useI18n';
import { useFeatures, type FeatureId } from '../../../features';
import { usePermissions, type PermissionId } from '../../../auth';
import type { TranslationKey } from '../../../i18n/types';

interface SidebarProps {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  isSidebarPermanent: boolean;
  isPointerFine: boolean;
  onCloseMobileDrawer: () => void;
  onToggleSidebar?: () => void;
}

interface NavItem {
  /** Stable identity, independent of the displayed label. */
  id: string;
  labelKey: TranslationKey;
  path: string;
  icon: string;
  /**
   * The module this entry belongs to. Omitted for the core screens, which are
   * the product itself and have no switch.
   */
  feature?: FeatureId;
  /**
   * The permission the screen needs.
   *
   * A module being switched on says the screen exists; this says whether
   * this person may use it. Both have to hold for the entry to appear.
   */
  permission?: PermissionId;
}

/**
 * Labels are translation keys, not strings: the sidebar has to relabel itself
 * when the locale changes without remounting.
 */
const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', path: '/dashboard', icon: 'dashboard', permission: 'reports.view' },
  { id: 'tables', labelKey: 'nav.tables', path: '/tables', icon: 'grid', feature: 'table-service', permission: 'orders.take' },
  { id: 'order', labelKey: 'nav.order', path: '/order/0', icon: 'list', permission: 'orders.take' },
  { id: 'kds', labelKey: 'nav.kds', path: '/kds', icon: 'chef-hat', feature: 'kds', permission: 'kitchen.view' },
  { id: 'pastOrders', labelKey: 'nav.pastOrders', path: '/past-orders', icon: 'clock', feature: 'reports', permission: 'reports.view' },
  { id: 'customers', labelKey: 'nav.customers', path: '/customers', icon: 'users', feature: 'customers', permission: 'customers.view' },
  { id: 'menu', labelKey: 'nav.menu', path: '/menu', icon: 'book-open', permission: 'menu.view' },
  { id: 'inventory', labelKey: 'nav.inventory', path: '/inventory', icon: 'inventory', feature: 'inventory', permission: 'inventory.view' },
  { id: 'expenses', labelKey: 'nav.expenses', path: '/expenses', icon: 'dollar', feature: 'expenses', permission: 'expenses.view' },
  { id: 'accounting', labelKey: 'nav.accounting', path: '/accounting', icon: 'chart-bar', feature: 'accounting', permission: 'reports.view' },
  { id: 'reports', labelKey: 'nav.reports', path: '/reports', icon: 'analytics', feature: 'reports', permission: 'reports.view' },
  { id: 'staff', labelKey: 'nav.staff', path: '/staff', icon: 'user', permission: 'staff.view' },
  { id: 'settings', labelKey: 'nav.settings', path: '/settings', icon: 'settings', permission: 'settings.view' },
];

const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  isMobileOpen,
  isSidebarPermanent,
  isPointerFine,
  onCloseMobileDrawer,
  onToggleSidebar,
}) => {
  const { t, dir } = useI18n();
  const { isActive } = useFeatures();

  // Hover state — only meaningful on pointer (mouse/trackpad) devices
  const [isHovered, setIsHovered] = useState(false);

  // Labels visible when: mobile open, OR desktop not-collapsed, OR desktop collapsed but hovered
  const isEffectivelyExpanded =
    !isSidebarPermanent || !isCollapsed || (isPointerFine && isHovered);

  // Entries belonging to a switched-off module disappear. The route is guarded
  // too, so a stale bookmark cannot reach a hidden screen.
  // Both gates: the module has to exist, and this person has to be allowed
  // to use it. While the permissions are still loading nothing is filtered
  // out on that basis, so the nav does not shed entries a moment after it
  // paints.
  const { can, loading: permissionsLoading } = usePermissions();

  const visibleNavItems = NAV_ITEMS.filter(item => (
    (!item.feature || isActive(item.feature)) &&
    (permissionsLoading || !item.permission || can(item.permission))
  ));

  const isRtl = dir === 'rtl';

  // Off-canvas direction: the drawer has to slide out towards its own edge.
  const hiddenTransform = isRtl ? 'translate-x-full' : '-translate-x-full';
  const isVisible = isSidebarPermanent || isMobileOpen;

  return (
    <aside
      onMouseEnter={isPointerFine ? () => { setIsHovered(true); } : undefined}
      onMouseLeave={isPointerFine ? () => { setIsHovered(false); } : undefined}
      className={[
        'fixed top-0 h-full z-50 flex flex-col bg-surface-inverse text-inverse',
        // `inset-inline-start` and a logical translate keep the drawer on the
        // correct edge in both directions.
        'start-0',
        'transition-[width,transform] duration-300 ease-in-out',
        isVisible ? 'translate-x-0' : hiddenTransform,
        isSidebarPermanent && isCollapsed && !isHovered ? 'w-[72px]' : 'w-[260px]',
      ].join(' ')}
    >

      {/* ── Header: Logo + Toggle ─────────────────────────────── */}
      <div className="flex items-center h-[72px] px-3 shrink-0 overflow-hidden border-b border-white/10">

        {/* Logo mark — always visible, so a collapsed rail still identifies the app */}
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
          <span className="text-lg font-bold">KP</span>
        </div>

        {/* App name — animated with a max-inline-size trick so the rail can collapse */}
        <span className={[
          'ms-3 font-bold text-lg overflow-hidden whitespace-nowrap',
          'transition-all duration-300 ease-in-out',
          isEffectivelyExpanded ? 'max-w-[150px] opacity-100' : 'max-w-0 opacity-0',
        ].join(' ')}>
          {t('app.name')}
        </span>

        {/* Pin/unpin — desktop + pointer device + currently expanded only */}
        {isSidebarPermanent && isPointerFine && isEffectivelyExpanded && onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="ms-auto text-white/60 hover:text-white hover:bg-white/10"
            aria-label={isCollapsed ? t('nav.pin') : t('nav.collapse')}
          >
            <SvgIcon
              name={isCollapsed ? 'pinned' : 'menu'}
              width="20"
              height="20"
              className="opacity-70 hover:opacity-100"
            />
          </Button>
        )}
      </div>

      {/* ── Nav items ─────────────────────────────────────────── */}
      <nav className="flex-1 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {visibleNavItems.map((item) => {
          const label = t(item.labelKey);
          return (
            <NavLink
              key={item.id}
              to={item.path}
              onClick={onCloseMobileDrawer}
              title={label}
              className={({ isActive }) => [
                'flex items-center h-[46px] rounded-xl mx-3 relative group cursor-pointer',
                'transition-all duration-300 ease-in-out whitespace-nowrap',
                !isEffectivelyExpanded ? 'w-12' : 'w-[calc(100%-24px)]',
                isActive
                  ? 'bg-white/15 text-white font-medium'
                  : 'text-white/60 hover:text-white hover:bg-white/10',
              ].join(' ')}
            >
              {/* Icon — always visible, fixed width so the rail does not jump */}
              <div className="w-12 h-full flex items-center justify-center shrink-0">
                <SvgIcon name={item.icon} width="20" height="20" />
              </div>

              <span className={[
                'text-sm overflow-hidden transition-all duration-300 ease-in-out',
                isEffectivelyExpanded ? 'max-w-[160px] opacity-100' : 'max-w-0 opacity-0',
              ].join(' ')}>
                {label}
              </span>

              {/* Flyout label for the collapsed rail; anchored to the inline end
                  so it opens away from the sidebar in both directions. */}
              {!isEffectivelyExpanded && (
                <span className={[
                  'absolute start-[calc(100%+8px)] px-2.5 py-1.5 z-50',
                  'bg-surface-inverse text-inverse text-xs rounded shadow-lg font-medium whitespace-nowrap',
                  'opacity-0 group-hover:opacity-100 pointer-events-none',
                  'transition-opacity duration-150',
                  'hidden group-hover:inline-block',
                ].join(' ')}>
                  {label}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

    </aside>
  );
};

export default Sidebar;
