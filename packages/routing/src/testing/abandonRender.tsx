import { Suspense, startTransition, use, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
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
 *
 * The transition stays suspended for the rest of the test, and inside `act`
 * React holds every later update behind it: a `setState` there never renders.
 * An event that only reads what is committed works anywhere; a test that
 * needs a render after the abandoned one makes it with {@link renderOutsideAct}.
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

/**
 * Runs `update` and renders what it schedules, synchronously. After
 * {@link renderThenAbandon}, an update made inside `act` is held behind the
 * suspended transition and never renders, so a test that needs a render
 * after the abandoned one makes it through here.
 */
export function renderOutsideAct(update: () => void): void {
  const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const was = env.IS_REACT_ACT_ENVIRONMENT;
  env.IS_REACT_ACT_ENVIRONMENT = false;
  try {
    flushSync(update);
  } finally {
    env.IS_REACT_ACT_ENVIRONMENT = was;
  }
}
