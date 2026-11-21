import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PropertyRow } from './PropertyRow';

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
