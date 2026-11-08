import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCloneSource } from './cloneSource';
import type { LensSourceRequest } from './lensSource';

const request = (over: Partial<LensSourceRequest<null>> = {}): LensSourceRequest<null> => ({
  lensId: 'lens-0',
  reticle: { x: 30, y: 20 },
  factor: 4,
  size: { width: 100, height: 80 },
  conditions: null,
  dpr: 1,
  ...over,
});

/** A trial body at (10, 10), 200 × 100, holding `inner`, and a slot to attach to; every point hits `hit`. */
function setup(inner = '<p class="probe">hello</p>') {
  const root = document.body.appendChild(document.createElement('div'));
  root.className = 'lk-trial__body';
  root.innerHTML = inner;
  Object.defineProperty(root, 'offsetWidth', { value: 200 });
  Object.defineProperty(root, 'offsetHeight', { value: 100 });
  root.getBoundingClientRect = () => ({ left: 10, top: 10, width: 200, height: 100 }) as DOMRect;
  const slot = document.body.appendChild(document.createElement('div'));
  const hit = root.firstElementChild as Element;
  document.elementsFromPoint = vi.fn(() => [hit]);
  return { root, slot };
}

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

afterEach(() => {
  document.body.replaceChildren();
});

describe('a clone source', () => {
  it('copies the trial body under the reticle into the slot', () => {
    const { slot } = setup();
    createCloneSource<null>().attach(slot, request());
    const copy = slot.querySelector('.lk-lens-copy');
    expect(copy?.hasAttribute('data-lk-copy')).toBe(true);
    expect(copy?.querySelector('.lk-trial__body .probe')?.textContent).toBe('hello');
  });

  it('puts the reticle’s point at the interior’s center, scaled by the factor', () => {
    const { slot } = setup();
    createCloneSource<null>().attach(slot, request());
    const copy = slot.querySelector<HTMLElement>('.lk-lens-copy');
    // The reticle sits 20, 10 into the body; × 4 is 80, 40, and the interior's center is 50, 40.
    expect(copy?.style.getPropertyValue('--lk-copy-x')).toBe('-30px');
    expect(copy?.style.getPropertyValue('--lk-copy-y')).toBe('0px');
    expect(copy?.style.getPropertyValue('--lk-copy-k')).toBe('4');
    expect(copy?.style.getPropertyValue('--lk-copy-w')).toBe('200px');
  });

  it('follows a new request to a new aim and factor', () => {
    const { slot } = setup();
    const handle = createCloneSource<null>().attach(slot, request());
    handle.update(request({ reticle: { x: 60, y: 20 }, factor: 2 }));
    const copy = slot.querySelector<HTMLElement>('.lk-lens-copy');
    expect(copy?.style.getPropertyValue('--lk-copy-x')).toBe('-50px');
    expect(copy?.style.getPropertyValue('--lk-copy-k')).toBe('2');
  });

  it('copies again on the frame after the trial changes', async () => {
    const { root, slot } = setup();
    createCloneSource<null>().attach(slot, request());
    (root.querySelector('.probe') as HTMLElement).textContent = 'changed';
    await Promise.resolve();
    await frame();
    expect(slot.querySelector('.lk-lens-copy .probe')?.textContent).toBe('changed');
  });

  it('shows nothing where no trial lies under the reticle, and skips another lens’s copy', () => {
    const { slot } = setup();
    const other = document.body.appendChild(document.createElement('div'));
    other.setAttribute('data-lk-copy', '');
    other.innerHTML = '<div class="lk-trial__body"><span></span></div>';
    document.elementsFromPoint = vi.fn(() => [other.querySelector('span') as Element]);
    createCloneSource<null>().attach(slot, request());
    expect(slot.querySelector('.lk-lens-copy')?.childElementCount).toBe(0);
  });

  it('takes its copy out of the slot on detach', () => {
    const { slot } = setup();
    createCloneSource<null>().attach(slot, request()).detach();
    expect(slot.querySelector('.lk-lens-copy')).toBeNull();
  });

  it('is always available, as Live', () => {
    const source = createCloneSource<null>();
    expect(source.status()).toBe(true);
    expect(source.kind).toBe('live');
    expect(source.label(request())).toBe('Live');
  });
});
