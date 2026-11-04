import type { PermissionId } from './context';

/**
 * Where to send someone who has nowhere in particular to be.
 *
 * `/dashboard` cannot simply be the landing page any more. It needs
 * `reports.view`, which a kitchen hand does not have — so sending them there
 * and then redirecting them away from it strands them in a loop, or on a
 * screen that is empty for them.
 *
 * The list is in the order a person would want: the broadest view they can
 * actually read, then the screen their role exists to use, and Settings last
 * because every role can at least open it.
 */
const CANDIDATES: readonly { path: string; permission: PermissionId }[] = [
  { path: '/dashboard', permission: 'reports.view' },
  { path: '/tables', permission: 'orders.take' },
  { path: '/kds', permission: 'kitchen.view' },
  { path: '/menu', permission: 'menu.view' },
  { path: '/inventory', permission: 'inventory.view' },
  { path: '/customers', permission: 'customers.view' },
  { path: '/settings', permission: 'settings.view' },
];

/**
 * The first route the permissions allow.
 *
 * Falls back to `/settings`: every shipped role holds `settings.view`, and a
 * role stripped of even that still needs somewhere that renders rather than
 * a blank screen with no way forward.
 */
export function homeRouteFor(granted: ReadonlySet<PermissionId>): string {
  return CANDIDATES.find(candidate => granted.has(candidate.permission))?.path ?? '/settings';
}

/** The candidate list, for the test that keeps it honest. */
export const HOME_CANDIDATES = CANDIDATES;
