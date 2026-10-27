import { afterEach, beforeEach } from 'vitest';

// Chrome raises a ResizeObserver loop as an ErrorEvent with no `error`, which vitest only logs, so a
// test whose observer is skipped passes. Through the prototype: vitest stops reporting every
// unhandled error while a listener added by `window.addEventListener` is attached.

/** Each observer callback: where its observer was made, the frame it ran in, and what it was handed.
 *  Formatted only when a loop is reported, so a passing test pays for a push. */
const calls: { frame: number; made: Error; entries: readonly ResizeObserverEntry[] }[] = [];
let frame = 0;
let inFrame = false;
const loopFrames: number[] = [];

const depthOf = (el: Element) => {
  let d = 0;
  for (let n: Element | null = el; n; n = n.parentElement) d++;
  return d;
};
const describeTarget = (el: Element) => {
  const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean) : [];
  return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls.map((c) => `.${c}`).join('')}@${depthOf(el)}`;
};

const Native = window.ResizeObserver;
window.ResizeObserver = class extends Native {
  constructor(callback: ResizeObserverCallback) {
    const made = new Error();
    super((entries, observer) => {
      if (!inFrame) {
        inFrame = true;
        frame++;
        setTimeout(() => {
          inFrame = false;
        }, 0);
      }
      calls.push({ frame, made, entries });
      if (calls.length > 400) calls.shift();
      callback(entries, observer);
    });
  }
};

let loops: string[] = [];
EventTarget.prototype.addEventListener.call(window, 'error', (e: Event) => {
  const { message } = e as ErrorEvent;
  if (!message?.startsWith('ResizeObserver loop')) return;
  loops.push(message);
  loopFrames.push(frame);
});
beforeEach(() => {
  loops = [];
  loopFrames.length = 0;
});
const nextFrame = () => new Promise<void>((done) => requestAnimationFrame(() => done()));

const siteOf = (made: Error) =>
  made.stack?.split('\n')[2]?.trim().replace(/https?:\/\/[^/]+\//, '').replace(/\?[^:]*:/, ':') ?? '?';
/** The observers that ran in the frame that looped and the one after it: the skipped
 *  notifications are delivered first in the next frame. */
const trace = (at: number) =>
  calls
    .filter((c) => c.frame === at || c.frame === at + 1)
    .map((c) => {
      const targets = c.entries.map((e) =>
        `${describeTarget(e.target)} ${Math.round(e.contentRect.width)}x${Math.round(e.contentRect.height)}`);
      return `  [${c.frame === at ? 'loop' : 'next'}] ${siteOf(c.made)} -> ${targets.join(', ')}`;
    })
    .join('\n');

afterEach(async () => {
  await nextFrame();
  await nextFrame();
  if (!loops.length) return;
  throw new Error(`${loops[0]} (${loops.length}× in this test)\n${trace(loopFrames[0] ?? 0)}`);
});
