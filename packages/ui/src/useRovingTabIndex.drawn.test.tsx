import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRovingTabIndex } from './useRovingTabIndex';

afterEach(cleanup);

const SHEET = '.gone { display: none } .ghost { visibility: hidden }';

type BarProps = { wrap?: { b?: string; c?: string }; root?: string; depth?: number; tick?: number; stop?: number };

/** A toolbar whose items `b` and `c` each sit in a wrapper classed by `wrap`, the whole under `depth` more wrappers. */
function Bar({ wrap, root, depth = 0, tick, stop }: BarProps) {
  const roving = useRovingTabIndex({ orientation: 'horizontal', ...(stop === undefined ? {} : { tabStopIndex: stop }) });
  let bar = (
    <div ref={roving.rootRef} onKeyDown={roving.onKeyDown} role="toolbar" className={root} data-tick={tick}>
      <button type="button">a</button>
      <span className={wrap?.b}><button type="button">b</button></span>
      <span className={wrap?.c}><button type="button">c</button></span>
      <button type="button">d</button>
    </div>
  );
  for (let i = 0; i < depth; i++) bar = <div>{bar}</div>;
  return <><style>{SHEET}</style>{bar}</>;
}

const button = (name: string) => screen.getByRole('button', { name, hidden: true });
const tabIndexes = () => ['a', 'b', 'c', 'd'].map((name) => button(name).tabIndex);

describe("useRovingTabIndex's drawn check without checkVisibility", () => {
  it('runs where the browser has no checkVisibility, as jsdom does', () => {
    expect('checkVisibility' in HTMLElement.prototype).toBe(false);
  });

  it("passes over an item a stylesheet hides through its wrapper's display or visibility", () => {
    render(<Bar wrap={{ b: 'gone', c: 'ghost' }} />);
    act(() => button('a').focus());
    fireEvent.keyDown(button('a'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(button('d'));
  });

  it('never gives the tab stop to an item hidden through its wrapper', () => {
    const view = render(<Bar stop={1} />);
    expect(tabIndexes()).toEqual([-1, 0, -1, -1]);
    view.rerender(<Bar stop={1} wrap={{ b: 'gone' }} />);
    expect(tabIndexes()).toEqual([0, -1, -1, -1]);
  });

  it('keeps a tab stop in a hidden container, so showing it by class alone leaves Tab a way in', () => {
    const view = render(<Bar root="gone" />);
    view.rerender(<Bar root="gone" tick={1} />);
    expect(tabIndexes()).toEqual([0, -1, -1, -1]);
  });

  it('reads computed style only between the item and its container, however deep the container sits', () => {
    const view = render(<Bar depth={30} />);
    const spy = vi.spyOn(window, 'getComputedStyle');
    view.rerender(<Bar depth={30} tick={1} />);
    // The first item and its container: a proxy for the cost, which grew with the document's depth before.
    expect(spy.mock.calls.length).toBeLessThanOrEqual(2);
    spy.mockRestore();
  });
});
