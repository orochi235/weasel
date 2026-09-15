import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isChunkLoadError, reloadOnce, type ReloadStore } from './chunkReload';

export interface PageBoundaryProps {
  readonly children: ReactNode;
  readonly reload: () => void;
  /** Where the last reload for a missing chunk is remembered. */
  readonly store: ReloadStore | undefined;
}

interface State {
  readonly failed: boolean;
  readonly error: unknown;
}

/** Keeps one page's failure inside that page: a demo that throws, or whose chunk is gone, leaves the sidebar standing. */
export class PageBoundary extends Component<PageBoundaryProps, State> {
  override state: State = { failed: false, error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, error };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    if (isChunkLoadError(error) && reloadOnce(this.props.store, Date.now())) {
      this.props.reload();
      return;
    }
    console.error('[weasel demos] a page failed', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    const { error } = this.state;
    const stale = isChunkLoadError(error);
    return (
      <div role="alert" className="ckd-page-error">
        <p>
          <strong>{stale ? 'This page could not load its code.' : 'This page failed to render.'}</strong>
          {stale ? ' The site was probably updated after this tab opened.' : null}
        </p>
        <pre>{error instanceof Error ? error.message : String(error)}</pre>
        <button type="button" onClick={this.props.reload}>
          Reload
        </button>
      </div>
    );
  }
}
