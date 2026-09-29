import { Suspense, startTransition, use, useState, type ReactNode } from 'react';
import { act, render } from '@testing-library/react';

const NEVER = new Promise<never>(() => {});

function Hang({ hang }: { hang: boolean }): null {
  if (hang) use(NEVER);
  return null;
}

/**
 * Commits `view(a)`, then starts a transition to `view(b)` that suspends, so
 * React renders `b` and throws that render away. Whatever `b` left behind is
 * what a later paint or event would wrongly see.
 */
export function renderThenAbandon<P>(a: P, b: P, view: (props: P) => ReactNode): void {
  let next!: (p: P) => void;
  function Host(): ReactNode {
    const [props, set] = useState<{ p: P }>({ p: a });
    next = (p) => set({ p });
    return (
      <Suspense fallback={null}>
        {view(props.p)}
        <Hang hang={props.p === b} />
      </Suspense>
    );
  }
  render(<Host />);
  act(() => { startTransition(() => { next(b); }); });
}
