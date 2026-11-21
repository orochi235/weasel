import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { useRef } from 'react';
import { useMenuLeast } from './useMenuLeast';
import { DockBarContext } from '../ToolbarDock/dockContext';

const realRO = globalThis.ResizeObserver;
let observed: Set<Element>;

beforeEach(() => {
  observed = new Set();
  globalThis.ResizeObserver = class {
    observe(target: Element) {
      observed.add(target);
    }
    unobserve(target: Element) {
      observed.delete(target);
    }
    disconnect() {
      observed.clear();
    }
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  globalThis.ResizeObserver = realRO;
});

function Menu({ withLead }: { withLead: boolean }) {
  const button = useRef<HTMLButtonElement | null>(null);
  const lead = useMenuLeast(button);
  return (
    <div>
      {withLead && <span ref={lead} data-testid="lead" />}
      <button ref={button}>Menu</button>
    </div>
  );
}

describe('useMenuLeast', () => {
  it('watches a lead that appears after the button mounted, and lets go of one that leaves', () => {
    const { rerender, getByTestId, getByRole } = render(<Menu withLead={false} />);
    expect([...observed]).toEqual([getByRole('button')]);
    rerender(<Menu withLead />);
    expect(observed.has(getByTestId('lead'))).toBe(true);
    rerender(<Menu withLead={false} />);
    expect([...observed]).toEqual([getByRole('button')]);
  });
});

describe('useMenuLeast in a right-to-left row', () => {
  it('spans the lead drawn to the right of the button', () => {
    const rect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const [left, right] = this.tagName === 'BUTTON' ? [100, 160] : [164, 180];
      return { left, right, top: 0, bottom: 20, width: right - left, height: 20, x: left, y: 0, toJSON: () => {} } as DOMRect;
    };
    const reported: (number | undefined)[] = [];
    try {
      render(
        <DockBarContext.Provider value={{ barId: 'b', label: 'B', movable: true, onLeast: (n) => { reported.push(n); } }}>
          <Menu withLead />
        </DockBarContext.Provider>,
      );
    } finally {
      Element.prototype.getBoundingClientRect = rect;
    }
    expect(reported.at(-1)).toBe(80);
  });
});
