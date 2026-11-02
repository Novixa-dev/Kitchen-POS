import React, { useCallback, useEffect, useState } from 'react';
import Sidebar from 'components/organisms/navigation/Sidebar';
import Header from 'components/organisms/navigation/Header';
import { useI18n } from '../i18n/useI18n';

const SIDEBAR_W = 260;
const COLLAPSED_W = 72;

interface Props {
  children: React.ReactNode;
}

const AppLayout: React.FC<Props> = ({ children }) => {
  const { dir } = useI18n();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1025);
  const [isPointerFine, setIsPointerFine] = useState(
    () => window.matchMedia('(pointer: fine)').matches,
  );

  useEffect(() => {
    const handleResize = () => { setIsDesktop(window.innerWidth >= 1025); };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(pointer: fine)');
    const handler = (e: MediaQueryListEvent) => { setIsPointerFine(e.matches); };
    mq.addEventListener('change', handler);
    return () => { mq.removeEventListener('change', handler); };
  }, []);

  // Permanent = wide screen AND fine pointer (mouse/trackpad). Touch tablets
  // always get the drawer, where a hover-to-expand rail is unusable.
  const isSidebarPermanent = isDesktop && isPointerFine;
  const sidebarWidth = isCollapsed ? COLLAPSED_W : SIDEBAR_W;

  const handleToggle = useCallback(() => { setIsCollapsed(c => !c); }, []);
  const handleOpen = useCallback(() => { setIsMobileOpen(true); }, []);
  const handleClose = useCallback(() => { setIsMobileOpen(false); }, []);

  // Close the drawer on Escape — a POS is driven largely from the keyboard.
  useEffect(() => {
    if (!isMobileOpen) { return; }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { handleClose(); } };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, [isMobileOpen, handleClose]);

  return (
    <div className="h-screen flex bg-surface-muted overflow-hidden">

      {/* Backdrop — mobile/touch drawer only */}
      <div
        className={[
          'fixed inset-0 bg-black/40 z-30 backdrop-blur-sm',
          'transition-opacity duration-300 ease-in-out',
          !isSidebarPermanent && isMobileOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={handleClose}
        aria-hidden="true"
      />

      <Sidebar
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        isSidebarPermanent={isSidebarPermanent}
        isPointerFine={isPointerFine}
        onCloseMobileDrawer={handleClose}
        onToggleSidebar={handleToggle}
      />

      {/*
        The sidebar is `position: fixed`, so the content needs a matching
        inline-start offset. `marginInlineStart` rather than `marginLeft`:
        under RTL the sidebar sits on the right, and a physical margin would
        push the content the wrong way and leave it underneath the rail.
      */}
      <main
        className="flex-1 flex flex-col h-screen transition-[margin] duration-300 overflow-hidden"
        style={{ marginInlineStart: isSidebarPermanent ? `${sidebarWidth}px` : 0 }}
      >
        <Header
          isSidebarPermanent={isSidebarPermanent}
          onOpenMobileDrawer={handleOpen}
        />
        {/* `key={dir}` forces a remount when the direction flips, so any
            scroll position measured in the old direction is discarded. */}
        <div key={dir} className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
