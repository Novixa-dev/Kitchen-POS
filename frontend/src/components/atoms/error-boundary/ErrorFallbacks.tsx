import { tStandalone as t } from '../../../i18n/standalone';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

/**
 * Error fallbacks.
 *
 * These deliberately use the standalone translator rather than `useI18n()`:
 * the root boundary wraps the i18n provider, so if the provider is what
 * threw, calling the hook here would throw again and leave a blank screen
 * instead of an error message.
 */

/** Full-page fallback — used at the app root. */
export const AppErrorFallback = ({ error, resetErrorBoundary }: ErrorFallbackProps) => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-surface-muted px-4">
    <div className="max-w-md w-full text-center">
      <div className="mx-auto h-16 w-16 bg-danger-subtle rounded-full flex items-center justify-center mb-6">
        <span className="text-danger text-3xl" aria-hidden="true">!</span>
      </div>

      <h1 className="text-2xl font-bold text-body mb-2">{t('error.appTitle')}</h1>
      <p className="text-muted mb-6">{t('error.appBody')}</p>

      <details className="mb-6 text-start bg-danger-subtle border border-danger/20 rounded-card p-4">
        <summary className="text-sm font-medium text-danger cursor-pointer">
          {t('error.details')}
        </summary>
        {/* `dir="ltr"` keeps the stack trace readable: it is code, not prose. */}
        <pre dir="ltr" className="mt-2 text-xs text-danger whitespace-pre-wrap wrap-break-word text-left">
          {error.message}
          {'\n\n'}
          {error.stack}
        </pre>
      </details>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          type="button"
          onClick={resetErrorBoundary}
          className="px-6 py-3 bg-brand text-on-brand rounded-control hover:bg-brand-hover transition-colors font-medium"
        >
          {t('error.tryAgain')}
        </button>
        <button
          type="button"
          // The app is served from a file:// URL when packaged, so a hash
          // route is the only safe "home".
          onClick={() => { window.location.hash = '#/'; window.location.reload(); }}
          className="px-6 py-3 bg-surface-sunken text-body rounded-control hover:bg-surface-muted transition-colors font-medium"
        >
          {t('error.goHome')}
        </button>
      </div>
    </div>
  </div>
);

/** Route-level fallback. */
export const PageErrorFallback = ({ error, resetErrorBoundary }: ErrorFallbackProps) => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
    <div className="max-w-md w-full text-center">
      <div className="mx-auto h-12 w-12 bg-warning-subtle rounded-full flex items-center justify-center mb-4">
        <span className="text-warning text-2xl" aria-hidden="true">!</span>
      </div>

      <h2 className="text-xl font-bold text-body mb-2">{t('error.pageTitle')}</h2>
      <p className="text-muted mb-4">{t('error.pageBody')}</p>

      {import.meta.env.DEV && (
        <p dir="ltr" className="text-sm text-danger bg-danger-subtle rounded-control p-3 mb-4 text-left wrap-break-word">
          {error.message}
        </p>
      )}

      <button
        type="button"
        onClick={resetErrorBoundary}
        className="px-5 py-2.5 bg-brand text-on-brand rounded-control hover:bg-brand-hover transition-colors font-medium"
      >
        {t('error.reloadScreen')}
      </button>
    </div>
  </div>
);

/** Section-level fallback — used around a single feature. */
export const WidgetErrorFallback = ({ resetErrorBoundary }: ErrorFallbackProps) => (
  <div className="flex flex-col items-center justify-center p-6 bg-surface-muted rounded-card border border-line">
    <p className="text-sm text-muted mb-3">{t('error.widgetBody')}</p>
    <button
      type="button"
      onClick={resetErrorBoundary}
      className="px-3 py-1.5 text-sm bg-surface-sunken text-body rounded-control hover:bg-surface-muted transition-colors"
    >
      {t('action.retry')}
    </button>
  </div>
);
