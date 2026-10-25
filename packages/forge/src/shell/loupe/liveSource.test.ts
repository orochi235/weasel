import type { LensSourceHandle, LensSourceRequest } from '@weasel-js/labkit/loupe';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { type ForgeComparison, resolveComparison } from './conditions';
import { createLiveLenses } from './liveLenses';
import { createLiveSource } from './liveSource';

// The readouts read the main story when a lens compares nothing, so that story is what the source must hear from.

let slot: HTMLElement;
let left: HTMLElement;
let right: HTMLElement;
let handle: LensSourceHandle<ForgeComparison> | null;
let heard: number;

const story = (id: string) => {
  const host = document.body.appendChild(document.createElement('div'));
  host.dataset.fgHost = id;
  host.append(document.createElement('p'));
  return host;
};

const request = (x: number, conditions: ForgeComparison | null): LensSourceRequest<ForgeComparison> => ({
  lensId: 'a',
  reticle: { x, y: 10 },
  factor: 4,
  size: { width: 160, height: 160 },
  conditions,
  dpr: 1,
});

function attach(x: number, conditions: ForgeComparison | null, schedule?: (run: () => void) => void) {
  const source = createLiveSource(
    createLiveLenses(),
    resolveComparison,
    () => ({
      base: { mode: 'light' },
      ctx: { declarations: {}, modeGlobal: 'mode', prefersDark: false, labMode: 'light' },
    }),
    schedule,
  );
  source.subscribe(() => {
    heard += 1;
  });
  handle = source.attach(slot, request(x, conditions));
  return handle;
}

const settle = () => new Promise<void>((done) => queueMicrotask(done));

beforeEach(() => {
  heard = 0;
  handle = null;
  slot = document.body.appendChild(document.createElement('div'));
  left = story('t1');
  right = story('t2');
  // jsdom does no hit-testing: `left` answers left of x = 500, `right` to the right of it.
  document.elementsFromPoint = (x: number) => [x < 500 ? left : right, document.body];
});

afterEach(() => {
  handle?.detach();
  for (const el of [slot, left, right]) el.remove();
});

it('tells its readers when the story under an uncompared lens changes', async () => {
  attach(100, null);
  await settle();
  heard = 0;
  left.querySelector('p')!.className = 'open';
  await settle();
  expect(heard).toBeGreaterThan(0);
});

it('tells its readers when the pointer or focus moves inside the story under an uncompared lens', () => {
  attach(100, null);
  heard = 0;
  const p = left.querySelector('p')!;
  for (const type of ['pointerover', 'pointerout', 'focusin', 'focusout', 'transitionend']) {
    p.dispatchEvent(new Event(type, { bubbles: true }));
  }
  expect(heard).toBe(5);
});

it('follows the reticle to the story now under it', async () => {
  const h = attach(100, null);
  h.update(request(600, null));
  await settle();
  heard = 0;
  left.querySelector('p')!.className = 'open';
  left.dispatchEvent(new Event('pointerover', { bubbles: true }));
  await settle();
  expect(heard).toBe(0);
  right.querySelector('p')!.className = 'open';
  await settle();
  expect(heard).toBeGreaterThan(0);
});

it('stops listening to the story once it compares something, and once detached', async () => {
  const h = attach(100, null);
  h.update(request(100, { kind: 'opposite-mode' }));
  await settle();
  heard = 0;
  left.querySelector('p')!.className = 'open';
  left.dispatchEvent(new Event('pointerover', { bubbles: true }));
  await settle();
  expect(heard).toBe(0);
  h.update(request(100, null));
  h.detach();
  handle = null;
  left.querySelector('p')!.className = 'shut';
  left.dispatchEvent(new Event('pointerover', { bubbles: true }));
  await settle();
  expect(heard).toBe(0);
});

it('tells its readers once per frame, however many changes the frame holds', async () => {
  const frames: (() => void)[] = [];
  attach(100, null, (run) => frames.push(run));
  await settle();
  for (const run of frames.splice(0)) run();
  heard = 0;
  const p = left.querySelector('p')!;
  p.className = 'open';
  p.dispatchEvent(new Event('pointerover', { bubbles: true }));
  slot.querySelector('.fg-lens-live')!.append(document.createElement('span'));
  await settle();
  p.className = 'shut';
  await settle();
  expect(heard).toBe(0);
  expect(frames).toHaveLength(1);
  for (const run of frames.splice(0)) run();
  expect(heard).toBe(1);
  // A change after the frame asks for the next one.
  p.className = 'open';
  await settle();
  expect(frames).toHaveLength(1);
});
