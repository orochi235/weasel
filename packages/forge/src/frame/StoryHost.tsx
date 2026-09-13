import { Component, type ReactNode } from 'react';
import type { Decorator, LoadedStory, StoryContext } from '../story/types';

export interface StoryHostProps {
  story: LoadedStory;
  ctx: StoryContext;
  /** Outermost decorators, from the frame setup. */
  decorators: readonly Decorator[];
  /** A change clears a caught error, so new input retries the render. */
  resetKey: number;
  onError: (error: unknown) => void;
}

function RenderStory({ story, ctx }: { story: LoadedStory; ctx: StoryContext }): ReactNode {
  return story.render(ctx);
}

function Decorated({ story, ctx, decorators }: Omit<StoryHostProps, 'resetKey' | 'onError'>): ReactNode {
  let inner: () => ReactNode = () => <RenderStory story={story} ctx={ctx} />;
  for (const decorate of [...story.decorators, ...decorators]) {
    const wrapped = inner;
    inner = () => decorate(wrapped, ctx);
  }
  return inner();
}

interface BoundaryState {
  error: unknown;
  failed: boolean;
  resetKey: number;
}

export class StoryHost extends Component<StoryHostProps, BoundaryState> {
  override state: BoundaryState = { error: null, failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromProps(props: StoryHostProps, state: BoundaryState): Partial<BoundaryState> | null {
    return props.resetKey === state.resetKey ? null : { error: null, failed: false, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return { error, failed: true };
  }

  override componentDidCatch(error: unknown): void {
    this.props.onError(error);
  }

  override render(): ReactNode {
    if (this.state.failed) {
      const { error } = this.state;
      return <pre className="fg-frame__fault">{error instanceof Error ? error.message : String(error)}</pre>;
    }
    const { story, ctx, decorators } = this.props;
    return <Decorated story={story} ctx={ctx} decorators={decorators} />;
  }
}
