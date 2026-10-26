import { configure } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach } from 'vitest';
import { commands } from 'vitest/browser';
import './scripts/vitest-request-log.setup.ts';

// Testing Library's `waitFor` and `findBy*` give up after one second, the same default the
// `browser` project already raises for `expect.poll`.
configure({ asyncUtilTimeout: 5000 });

// A removed test frame keeps its Mach ports until a full GC, often thousands per file, and a tab
// whose renderer nears 15,000 loses every socket to the server ("Browser connection was closed").
beforeAll(() => commands.collectGarbage());

beforeAll(() => commands.settleFrame());

// Chrome raises a ResizeObserver loop as an ErrorEvent with no `error`, which vitest only logs, so a
// test whose observer is skipped passes. Through the prototype: vitest stops reporting every
// unhandled error while a listener added by `window.addEventListener` is attached.
let resizeLoops = 0;
EventTarget.prototype.addEventListener.call(window, 'error', (e: Event) => {
  if ((e as ErrorEvent).message?.startsWith('ResizeObserver loop')) resizeLoops++;
});
beforeEach(() => {
  resizeLoops = 0;
});
const frame = () => new Promise<void>((done) => requestAnimationFrame(() => done()));
afterEach(async () => {
  await frame();
  await frame();
  if (resizeLoops) {
    throw new Error(`ResizeObserver loop completed with undelivered notifications (${resizeLoops}× in this test)`);
  }
});
