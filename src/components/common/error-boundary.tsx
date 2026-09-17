import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { strings } from '@/i18n';
import { rememberError } from '@/lib/last-error';

interface Props {
  readonly children: ReactNode;
  /** Shown instead of the children; defaults to a small card with a reload button. */
  readonly fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  readonly error: Error | null;
}

/**
 * Keeps one broken screen from taking the whole app down. Every dashboard widget of
 * stage 3 gets its own boundary; this one guards the page area.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    rememberError(error);
    console.error('Error on screen:', error, info.componentStack);
  }

  private readonly reset = () => this.setState({ error: null });

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-5">
        <p className="text-sm font-semibold">{strings.errors.screenTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" onClick={this.reset}>
            {strings.errors.retry}
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            {strings.database.blockedAction}
          </Button>
        </div>
      </div>
    );
  }
}
