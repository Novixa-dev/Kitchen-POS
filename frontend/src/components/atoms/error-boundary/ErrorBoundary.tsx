import { Component, ErrorInfo, ReactNode } from 'react';
import { tStandalone as t } from '../../../i18n/standalone';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Static fallback element to show when an error occurs */
  fallback?: ReactNode;
  /** Render-prop style fallback with access to error and reset function */
  fallbackRender?: (props: {
    error: Error;
    resetErrorBoundary: () => void;
  }) => ReactNode;
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Callback when the error boundary resets */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error details
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary] Caught error:', error);
      console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    }

    // Call optional error handler (e.g., send to error tracking service)
    this.props.onError?.(error, errorInfo);
  }

  resetErrorBoundary = (): void => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // Prefer fallbackRender (render-prop) over static fallback
      if (this.props.fallbackRender) {
        return this.props.fallbackRender({
          error: this.state.error,
          resetErrorBoundary: this.resetErrorBoundary,
        });
      }

      // Use static fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback
      return (
        <div className="min-h-[200px] flex flex-col items-center justify-center p-8">
          <h2 className="text-xl font-bold text-body">{t('error.title')}</h2>
          <p className="text-muted mt-2 text-center">{t('error.body')}</p>
          <button
            type="button"
            onClick={this.resetErrorBoundary}
            className="mt-4 px-4 py-2 bg-brand text-on-brand rounded-control hover:bg-brand-hover transition-colors"
          >
            {t('error.tryAgain')}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
