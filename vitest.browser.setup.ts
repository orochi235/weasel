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
// Where each observer whose callback ran since the last task was made: the error is dispatched
// right after the frame's callbacks, before any task, so these are the frame's.
const delivered = new Set<string>();
const Native = window.ResizeObserver;
window.ResizeObserver = class extends Native {
  constructor(callback: ResizeObserverCallback) {
    const site = (new Error().stack ?? '').split('\n').slice(2, 4).map((l) => l.trim()).join(' < ');
    super((entries, observer) => {
      if (delivered.size === 0) setTimeout(() => delivered.clear(), 0);
      delivered.add(site);
      callback(entries, observer);
    });
  }
};
EventTarget.prototype.addEventListener.call(window, 'error', (e: Event) => {
  const { message } = e as ErrorEvent;
  if (message?.startsWith('ResizeObserver loop')) resizeLoops.push(`${message} [${[...delivered].join(' | ')}]`);
});
beforeEach(() => {
  resizeLoops = [];
});
const frame = () => new Promise<void>((done) => requestAnimationFrame(() => done()));
afterEach(async () => {
  await frame();
  await frame();
  if (resizeLoops.length) throw new Error(`${resizeLoops.join('\n')} (raised ${resizeLoops.length}×)`);
});
