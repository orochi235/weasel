import { afterEach, describe, expect, it } from 'vitest';
import { trialAt } from './trialAt';

// jsdom does no hit-testing or layout: `elementsFromPoint`, `getBoundingClientRect` and `offsetWidth` are stood in
// for, so these assert the mapping and the walk, given the stack a browser would report.

function host(id: string, opts: { copy?: boolean; rect: DOMRect; offsetWidth: number }): HTMLElement {
  const el = document.createElement('div');
  el.dataset.fgHost = id;
  if (opts.copy) el.setAttribute('data-fg-copy', '');
  el.getBoundingClientRect = () => opts.rect;
  Object.defineProperty(el, 'offsetWidth', { value: opts.offsetWidth });
  document.body.append(el);
  return el;
}

function stack(...elements: Element[]) {
  document.elementsFromPoint = () => elements;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('trialAt', () => {
  it('maps a client point into a zoomed host’s own px', () => {
    const main = host('t1', { rect: new DOMRect(100, 50, 200, 150), offsetWidth: 400 });
    const child = main.appendChild(document.createElement('span'));
    stack(child, main, document.body);
    const hit = trialAt({ x: 150, y: 80 });
    expect(hit).toEqual({ trialId: 't1', host: main, local: { x: 100, y: 60 }, scale: 0.5 });
  });

  it('skips copies when finding the trial under a point', () => {
    const main = host('t1', { rect: new DOMRect(0, 0, 400, 300), offsetWidth: 400 });
    const copy = host('t1~lens-a', { copy: true, rect: new DOMRect(0, 0, 400, 300), offsetWidth: 400 });
    const inCopy = copy.appendChild(document.createElement('span'));
    stack(inCopy, copy, main, document.body);
    expect(trialAt({ x: 10, y: 20 })?.host).toBe(main);
  });

  it('finds nothing where no trial host is under the point', () => {
    stack(document.body);
    expect(trialAt({ x: 10, y: 20 })).toBeNull();
  });
});
