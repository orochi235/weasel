import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ActionsProvider } from '@weasel-js/routing/react';
import { isApplePlatform } from '@weasel-js/gestures';
import type { PrefGroup, PrefLeaf, PrefOrder } from '@weasel-js/prefs';
import { RegisterAction } from '@weasel-js/routing/testing/registerAction';
import { PrefsBar } from '../PrefsBar/PrefsBar';

// jsdom lays nothing out: the bar is 80 by 40, wrapping its four 40 by 20 cells two to a line.
const realRect = Element.prototype.getBoundingClientRect;
const box = (left: number, top: number, width: number, height: number) =>
  ({ x: left, y: top, left, top, right: left + width, bottom: top + height, width, height, toJSON: () => {} }) as DOMRect;
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function rect(this: Element) {
    if (this.getAttribute('role') === 'toolbar') return box(0, 0, 80, 40);
    const cell = this.closest('[data-bar-item]');
    const i = cell ? Array.from(this.ownerDocument.querySelectorAll('[data-bar-item]')).indexOf(cell) : -1;
    return i < 0 ? box(0, 0, 0, 0) : box((i % 2) * 40, Math.floor(i / 2) * 20, 40, 20);
  };
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect;
});
afterEach(cleanup);

const MOD: Record<string, boolean> = isApplePlatform() ? { metaKey: true } : { ctrlKey: true };
const act = (name: string): PrefLeaf => ({ kind: 'action', name, description: '', default: undefined, action: `x.${name}` }) as PrefLeaf;
const four: PrefGroup = { name: 'Tools', children: { a: act('a'), b: act('b'), c: act('c'), d: act('d') } };
const at = (clientX: number, clientY: number) => ({ pointerId: 1, button: 0, buttons: 1, pointerType: 'mouse', clientX, clientY, ...MOD });

it('drops a drag on a wrapped bar into the gap on the line it is released over', () => {
  const onReorder = vi.fn<(order: PrefOrder) => void>();
  render(
    <ActionsProvider>
      {['a', 'b', 'c', 'd'].map((n) => <RegisterAction key={n} action={{ id: `x.${n}`, label: n, group: 'x', invoker: { timing: 'immediate', run: () => {} } }} />)}
      <PrefsBar schema={four} label="Tools" wrap onReorder={onReorder} />
    </ActionsProvider>,
  );
  fireEvent.pointerDown(screen.getByRole('button', { name: 'd' }), at(60, 30));
  fireEvent.pointerMove(document, at(30, 30));
  fireEvent.pointerMove(document, at(5, 30));
  fireEvent.pointerUp(document, { ...at(5, 30), buttons: 0 });
  expect(onReorder).toHaveBeenCalledWith({ '': ['a', 'b', 'd', 'c'] });
});
