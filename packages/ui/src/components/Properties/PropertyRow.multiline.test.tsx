import type { ReactElement } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PropertyRow } from './PropertyRow';
import { RowScope } from './rowScope';

// jsdom has no ResizeObserver, so the row would measure nothing; this one records what it is asked to watch.
let watched: Set<Element>;
class Recorder {
  private readonly mine = new Set<Element>();
  observe(el: Element): void {
    this.mine.add(el);
    watched.add(el);
  }
  disconnect(): void {
    for (const el of this.mine) watched.delete(el);
    this.mine.clear();
  }
  unobserve(): void {}
}

beforeEach(() => {
  watched = new Set();
  vi.stubGlobal('ResizeObserver', Recorder);
});
afterEach(() => vi.unstubAllGlobals());

const rowOf = (container: HTMLElement) => container.querySelector('[data-property-row]') as HTMLElement;

describe('an inline row measuring whether it runs past one line', () => {
  it('watches its new root when `group` swaps the root element', () => {
    const { container, rerender } = render(
      <PropertyRow label="Mode" layout="inline"><input aria-label="Mode" /></PropertyRow>,
    );
    expect(watched.has(rowOf(container))).toBe(true);
    rerender(<PropertyRow label="Mode" layout="inline" group><input aria-label="Mode" /></PropertyRow>);
    expect(rowOf(container).tagName).toBe('DIV');
    expect(watched.has(rowOf(container))).toBe(true);
  });

  it('watches a control that replaces the one it started with', async () => {
    const { container, rerender } = render(
      <PropertyRow label="Mode" layout="inline"><input key="a" aria-label="Mode" /></PropertyRow>,
    );
    rerender(<PropertyRow label="Mode" layout="inline"><select key="b" aria-label="Mode" /></PropertyRow>);
    await act(async () => {});
    expect(watched.has(container.querySelector('select') as Element)).toBe(true);
  });
});

describe('an inline row with a wrapped validation message', () => {
  const callbacks: (() => void)[] = [];
  beforeEach(() => {
    callbacks.length = 0;
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: () => void) { callbacks.push(cb); }
      observe(): void {}
      disconnect(): void {}
      unobserve(): void {}
    });
    vi.stubGlobal('getComputedStyle', () => ({ lineHeight: '20px', fontSize: '16px', minHeight: '24px' }));
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const tall = this.getAttribute('role') === 'alert' || this.tagName === 'TEXTAREA';
      return { height: tall ? 60 : 20 } as DOMRect;
    });
  });
  afterEach(() => vi.restoreAllMocks());
  const measured = (ui: ReactElement) => {
    const { container } = render(ui);
    act(() => callbacks.forEach((cb) => cb()));
    return rowOf(container).hasAttribute('data-multiline');
  };

  it('stays one line, since the message has a line of its own', () => {
    expect(measured(<RowScope error="far too long a message to fit"><PropertyRow label="Gap" layout="inline"><input aria-label="Gap" /></PropertyRow></RowScope>)).toBe(false);
  });

  it('still runs past one line beside a tall control', () => {
    expect(measured(<PropertyRow label="Note" layout="inline"><textarea aria-label="Note" /></PropertyRow>)).toBe(true);
  });
});
