import { Suspense, startTransition, useState, type ReactNode } from 'react';
import { act, render } from '@testing-library/react';

const NEVER = new Promise<never>(() => {});

/**
 * Suspends for good while `hang` is set. Inside a `<Suspense>` whose content
 * has already committed, a transition that sets it is rendered and thrown
 * away. {@link renderThenAbandon} is built on it; reach for it directly only
 * when a test needs its own steps around the abandon.
 */
export function Hang({ hang }: { hang: boolean }): null {
  // Thrown rather than passed to `use`: React waits for a `use`d promise inside
  // `act`, so a sync `act` warns and an awaited one holds every later update.
  if (hang) throw NEVER;
  return null;
}

/**
 * Commits `view(a)`, then starts a transition to `view(b)` that suspends, so
 * React renders `b` and throws that render away. Whatever `b` left behind is
 * what a later paint or event would wrongly see.
 *
 * The transition stays suspended for the rest of the test. A later update
 * renders and commits as usual, and React renders `b` again behind it and
 * throws that away too.
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
