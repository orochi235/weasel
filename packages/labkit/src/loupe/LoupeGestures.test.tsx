import { act, fireEvent, render, screen } from '@testing-library/react';
import { WeaselProvider } from '@weasel-js/core';
import { giveKeys } from '@weasel-js/react/testing/giveKeys';
import { type ReactNode, type RefObject, useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { LoupeGestures } from './LoupeGestures';
import { resolveLoupe } from './types';
import { useLoupe } from './useLoupe';

/** A loupe that is off, so only the peek key can raise it. `wrap` puts its
 *  gestures under a provider of the test's choosing. */
function Wall({ id, wrap }: { id: string; wrap: (children: ReactNode) => ReactNode }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const options = resolveLoupe({});
  const loupe = useLoupe({
    hostRef: hostRef as RefObject<HTMLElement | null>,
    enabled: false,
    options,
  });
  return (
    <div ref={hostRef} data-testid={id}>
      {wrap(
        <LoupeGestures
          hostRef={hostRef as RefObject<HTMLElement | null>}
          input={loupe.input}
          peekKey={options.peekKey ?? null}
        />,
      )}
      <span data-testid={`${id}-visible`}>{String(loupe.visible)}</span>
    </div>
  );
}

const isolated = (children: ReactNode) => <WeaselProvider isolate>{children}</WeaselProvider>;
const bare = (children: ReactNode) => children;

const visible = (id: string): string => screen.getByTestId(`${id}-visible`).textContent ?? '';

function peek(): void {
  act(() => {
    fireEvent.keyDown(window, { key: 'Alt' });
  });
}

describe('<LoupeGestures> with two loupes on the page', () => {
  it('peeks the loupe under the pointer, though the other was pressed last', () => {
    render(
      <>
        <Wall id="a" wrap={isolated} />
        <Wall id="b" wrap={isolated} />
      </>,
    );
    giveKeys(screen.getByTestId('a'));
    fireEvent.pointerMove(screen.getByTestId('b'), { clientX: 10, clientY: 10 });
    peek();
    expect(visible('b')).toBe('true');
    expect(visible('a')).toBe('false');
  });

  it('peeks the loupe under the pointer before anything is pressed', () => {
    render(
      <>
        <Wall id="a" wrap={isolated} />
        <Wall id="b" wrap={isolated} />
      </>,
    );
    fireEvent.pointerMove(screen.getByTestId('b'), { clientX: 10, clientY: 10 });
    peek();
    expect(visible('b')).toBe('true');
  });

  it('peeks the loupe under the pointer when both register under one provider', () => {
    render(
      <WeaselProvider isolate>
        <Wall id="a" wrap={bare} />
        <Wall id="b" wrap={bare} />
      </WeaselProvider>,
    );
    fireEvent.pointerMove(screen.getByTestId('a'), { clientX: 10, clientY: 10 });
    peek();
    expect(visible('a')).toBe('true');
    expect(visible('b')).toBe('false');
  });

  it('peeks a loupe the pointer moves onto with the key already held', () => {
    render(<Wall id="a" wrap={isolated} />);
    giveKeys(screen.getByTestId('a'));
    peek();
    fireEvent.pointerMove(screen.getByTestId('a'), { clientX: 10, clientY: 10 });
    expect(visible('a')).toBe('true');
  });

  it('carries a held peek from one loupe to the next', () => {
    render(
      <>
        <Wall id="a" wrap={isolated} />
        <Wall id="b" wrap={isolated} />
      </>,
    );
    fireEvent.pointerMove(screen.getByTestId('a'), { clientX: 10, clientY: 10 });
    peek();
    fireEvent.pointerLeave(screen.getByTestId('a'));
    fireEvent.pointerMove(screen.getByTestId('b'), { clientX: 10, clientY: 10 });
    expect(visible('a')).toBe('false');
    expect(visible('b')).toBe('true');
  });
});
