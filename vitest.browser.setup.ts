import { configure } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach } from 'vitest';
import { commands } from 'vitest/browser';

// Testing Library's `waitFor` and `findBy*` give up after one second, the same default the
// `browser` project already raises for `expect.poll`.
configure({ asyncUtilTimeout: 5000 });

// A removed test frame keeps its Mach ports until a full GC, often thousands per file, and a tab
// whose renderer nears 15,000 loses every socket to the server ("Browser connection was closed").
beforeAll(() => commands.collectGarbage());

beforeAll(() => commands.settleFrame());

// Chrome raises a ResizeObserver loop as an ErrorEvent with no `error`, which vitest only logs, so
// a test whose observer resizes its own target passes. Through the prototype: vitest stops
// reporting every unhandled error while a listener added by `window.addEventListener` is attached.
let resizeLoops: string[] = [];
// TEMPORARY probe: each observer callback, by the batch (frame) it ran in, with its targets.
let batch = 0;
let inBatch = false;
const calls: { batch: number; line: string }[] = [];
const loopBatches: number[] = [];
const depthOf = (el: Element) => {
  let d = 0;
  for (let n: Element | null = el; n; n = n.parentElement) d++;
  return d;
};
const describe = (el: Element) =>
  `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).join('.')}` : ''}@${depthOf(el)}`;
const Native = window.ResizeObserver;
window.ResizeObserver = class extends Native {
  constructor(callback: ResizeObserverCallback) {
    const site = (new Error().stack ?? '')
      .split('\n')
      .slice(2, 3)
      .map((l) => l.trim().replace(/https?:\/\/[^/]+\//, '').replace(/\?[^:]*:/, ':'))
      .join('');
    super((entries, observer) => {
      if (!inBatch) {
        inBatch = true;
        batch++;
        setTimeout(() => {
          inBatch = false;
        }, 0);
      }
      const targets = entries
        .map((e) => `${describe(e.target)} ${Math.round(e.contentRect.width)}x${Math.round(e.contentRect.height)}`)
        .join(', ');
      calls.push({ batch, line: `${site} -> ${targets}` });
      if (calls.length > 400) calls.shift();
      callback(entries, observer);
    });
  }
};
EventTarget.prototype.addEventListener.call(window, 'error', (e: Event) => {
  const { message } = e as ErrorEvent;
  if (message?.startsWith('ResizeObserver loop')) {
    resizeLoops.push(message);
    loopBatches.push(batch);
  }
});
beforeEach(() => {
  resizeLoops = [];
  loopBatches.length = 0;
});
const frame = () => new Promise<void>((done) => requestAnimationFrame(() => done()));
afterEach(async () => {
  await frame();
  await frame();
  if (!resizeLoops.length) return;
  const b = loopBatches[0] ?? 0;
  const trace = calls
    .filter((c) => c.batch === b || c.batch === b + 1)
    .map((c) => `  [${c.batch === b ? 'loop' : 'next'}] ${c.line}`)
    .join('\n');
  throw new Error(`${resizeLoops[0]} (raised ${resizeLoops.length}×)\nRO-TRACE-BEGIN\n${trace}\nRO-TRACE-END`);
});
