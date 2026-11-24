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
  Object.defineProperty(root, 'offsetWidth', { value: 200, writable: true });
  Object.defineProperty(root, 'offsetHeight', { value: 100, writable: true });
  root.getBoundingClientRect = () => ({ left: 10, top: 10, width: 200, height: 100 }) as DOMRect;
  const slot = document.body.appendChild(document.createElement('div'));
  const hit = root.firstElementChild as Element;
  document.elementsFromPoint = vi.fn(() => [hit]);
  return { root, slot };
}

/** The frames a source has asked for, run by hand. */
let frames: Array<() => void> = [];
const onFrame = (run: () => void) => {
  frames.push(run);
};
const frame = () => {
  const due = frames;
  frames = [];
  for (const run of due) run();
};

afterEach(() => {
  frames = [];
  document.body.replaceChildren();
});

describe('a clone source', () => {
  it('copies the trial body under the reticle into the slot', () => {
    const { slot } = setup();
    createCloneSource<null>({ onFrame }).attach(slot, request());
    const copy = slot.querySelector('.lk-lens-copy');
    expect(copy?.hasAttribute('data-lk-copy')).toBe(true);
    expect(copy?.querySelector('.lk-trial__body .probe')?.textContent).toBe('hello');
  });

  it('puts the reticle’s point at the interior’s center, scaled by the factor', () => {
    const { slot } = setup();
    createCloneSource<null>({ onFrame }).attach(slot, request());
    const copy = slot.querySelector<HTMLElement>('.lk-lens-copy');
    // The reticle sits 20, 10 into the body; × 4 is 80, 40, and the interior's center is 50, 40.
    expect(copy?.style.getPropertyValue('--lk-copy-x')).toBe('-30px');
    expect(copy?.style.getPropertyValue('--lk-copy-y')).toBe('0px');
    expect(copy?.style.getPropertyValue('--lk-copy-kx')).toBe('4');
    expect(copy?.style.getPropertyValue('--lk-copy-ky')).toBe('4');
    expect(copy?.style.getPropertyValue('--lk-copy-w')).toBe('200px');
  });

  it('follows a new request to a new aim and factor', () => {
    const { slot } = setup();
    const handle = createCloneSource<null>({ onFrame }).attach(slot, request());
    handle.update(request({ reticle: { x: 60, y: 20 }, factor: 2 }));
    const copy = slot.querySelector<HTMLElement>('.lk-lens-copy');
    expect(copy?.style.getPropertyValue('--lk-copy-x')).toBe('-50px');
    expect(copy?.style.getPropertyValue('--lk-copy-kx')).toBe('2');
  });

  it('scales each axis by the trial’s own scale on it, under a non-uniform transform', () => {
    const { root, slot } = setup();
    // Drawn at scale(1, 0.5): 200 × 50 on screen for a 200 × 100 layout box.
    root.getBoundingClientRect = () => ({ left: 10, top: 10, width: 200, height: 50 }) as DOMRect;
    createCloneSource<null>({ onFrame }).attach(slot, request());
    const copy = slot.querySelector<HTMLElement>('.lk-lens-copy');
    // The reticle sits 10 screen px down, 20 layout px; × 4 × 0.5 is 40, at the interior's center.
    expect(copy?.style.getPropertyValue('--lk-copy-ky')).toBe('2');
    expect(copy?.style.getPropertyValue('--lk-copy-y')).toBe('0px');
    expect(copy?.style.getPropertyValue('--lk-copy-kx')).toBe('4');
  });

  it('copies again on the frame after the trial changes', async () => {
    const { root, slot } = setup();
    createCloneSource<null>({ onFrame }).attach(slot, request());
    (root.querySelector('.probe') as HTMLElement).textContent = 'changed';
    await Promise.resolve();
    frame();
    expect(slot.querySelector('.lk-lens-copy .probe')?.textContent).toBe('changed');
  });

  it('shows nothing where no trial lies under the reticle, and skips another lens’s copy', () => {
    const { slot } = setup();
    const other = document.body.appendChild(document.createElement('div'));
    other.setAttribute('data-lk-copy', '');
    other.innerHTML = '<div class="lk-trial__body"><span></span></div>';
    document.elementsFromPoint = vi.fn(() => [other.querySelector('span') as Element]);
    createCloneSource<null>({ onFrame }).attach(slot, request());
    expect(slot.querySelector('.lk-lens-copy')?.childElementCount).toBe(0);
  });

  it('asks for no frame once its copy is current and holds no canvas', async () => {
    const { root, slot } = setup();
    createCloneSource<null>({ onFrame }).attach(slot, request());
    frame();
    expect(frames).toHaveLength(0);
    (root.querySelector('.probe') as HTMLElement).textContent = 'changed';
    await Promise.resolve();
    expect(frames).toHaveLength(1);
  });

  it('takes its copy out of the slot on detach', () => {
    const { slot } = setup();
    createCloneSource<null>({ onFrame }).attach(slot, request()).detach();
    expect(slot.querySelector('.lk-lens-copy')).toBeNull();
  });

  it('is always available, as Live', () => {
    const source = createCloneSource<null>({ onFrame });
    expect(source.status()).toBe(true);
    expect(source.kind).toBe('live');
    expect(source.label(request())).toBe('Live');
  });

  it('leaves the trial’s own radio checked, and its copy shows it checked too', () => {
    const { root, slot } = setup(
      '<p class="probe"><input type="radio" name="size" value="s" checked><input type="radio" name="size" value="m"></p>',
    );
    createCloneSource<null>({ onFrame }).attach(slot, request());
    const own = root.querySelector<HTMLInputElement>('input[value="s"]');
    const copied = slot.querySelector<HTMLInputElement>('input[value="s"]');
    expect(own?.checked).toBe(true);
    expect(copied?.checked).toBe(true);
  });

  it('keeps a copied control that names the trial’s form by id out of that form', () => {
    const { slot } = setup(
      '<p class="probe"><input name="q" value="x" form="f"><form id="f"></form></p>',
    );
    createCloneSource<null>({ onFrame }).attach(slot, request());
    const form = document.getElementById('f') as HTMLFormElement;
    expect([...form.elements].map((el) => el.closest('[data-lk-copy]') !== null)).toEqual([false]);
  });

  it('starts no load or playback in its copy', () => {
    const { slot } = setup(
      '<p class="probe"><iframe src="about:blank#x"></iframe><video autoplay src="a.webm"></video></p>',
    );
    createCloneSource<null>({ onFrame }).attach(slot, request());
    expect(slot.querySelector('iframe')?.hasAttribute('src')).toBe(false);
    expect(slot.querySelector('video')?.hasAttribute('autoplay')).toBe(false);
  });

  it('loads no object or embed a second time in its copy', () => {
    const { slot } = setup(
      '<p class="probe"><object data="a.svg"></object><embed src="b.svg"></p>',
    );
    createCloneSource<null>({ onFrame }).attach(slot, request());
    expect(slot.querySelector('object')?.hasAttribute('data')).toBe(false);
    expect(slot.querySelector('embed')?.hasAttribute('src')).toBe(false);
  });

  it('leaves every id to the trial, so its lookups never land on the copy', () => {
    const { root, slot } = setup('<p class="probe"><span id="t">own</span></p>');
    root.id = 'body';
    createCloneSource<null>({ onFrame }).attach(slot, request());
    const copy = slot.querySelector('.lk-lens-copy') as Element;
    expect(copy.querySelector('.probe span')?.textContent).toBe('own');
    expect(copy.querySelectorAll('[id]')).toHaveLength(0);
    expect(document.getElementById('t')?.closest('[data-lk-copy]')).toBeNull();
  });
});

describe('a clone source keeping its copy current', () => {
  it('sizes its copy again when a change in the trial resizes the trial', async () => {
    const { root, slot } = setup();
    createCloneSource<null>({ onFrame }).attach(slot, request());
    (root as { offsetHeight: number }).offsetHeight = 300;
    (root.querySelector('.probe') as HTMLElement).textContent = 'taller';
    await Promise.resolve();
    frame();
    const copy = slot.querySelector<HTMLElement>('.lk-lens-copy');
    expect(copy?.style.getPropertyValue('--lk-copy-h')).toBe('300px');
  });

  it('shows a control’s value and checkedness as the trial’s own control holds them', () => {
    const { root, slot } = setup(
      '<p class="probe"><input class="text"><input class="tick" type="checkbox"><select><option>a</option><option>b</option></select></p>',
    );
    createCloneSource<null>({ onFrame }).attach(slot, request());
    const own = (sel: string) => root.querySelector(sel) as HTMLInputElement & HTMLSelectElement;
    const copied = (sel: string) =>
      slot.querySelector(`.lk-lens-copy ${sel}`) as HTMLInputElement & HTMLSelectElement;
    own('.text').value = 'typed';
    own('.text').dispatchEvent(new Event('input', { bubbles: true }));
    own('.tick').checked = true;
    own('.tick').dispatchEvent(new Event('change', { bubbles: true }));
    own('select').selectedIndex = 1;
    own('select').dispatchEvent(new Event('change', { bubbles: true }));
    frame();
    expect(copied('.text').value).toBe('typed');
    expect(copied('.tick').checked).toBe(true);
    expect(copied('select').selectedIndex).toBe(1);
  });

  it('scrolls its copy’s scrollers as far as the trial’s own', () => {
    const scrolled = new WeakMap<Element, number>();
    const prior = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
    Object.defineProperty(Element.prototype, 'scrollTop', {
      configurable: true,
      get(this: Element) {
        return scrolled.get(this) ?? 0;
      },
      set(this: Element, v: number) {
        scrolled.set(this, v);
      },
    });
    try {
      const { root, slot } = setup('<div class="list"><p class="probe">row</p></div>');
      const list = root.querySelector('.list') as HTMLElement;
      list.scrollTop = 400;
      createCloneSource<null>({ onFrame }).attach(slot, request());
      const copied = slot.querySelector('.lk-lens-copy .list') as HTMLElement;
      expect(copied.scrollTop).toBe(400);
      list.scrollTop = 120;
      list.dispatchEvent(new Event('scroll'));
      frame();
      expect(copied.scrollTop).toBe(120);
    } finally {
      if (prior) Object.defineProperty(Element.prototype, 'scrollTop', prior);
    }
  });
});

describe('a clone source whose root holds the lens', () => {
  it('copies nothing rather than its own copies', () => {
    const outer = document.body.appendChild(document.createElement('div'));
    outer.className = 'lk-lab__body';
    const probe = outer.appendChild(document.createElement('p'));
    probe.textContent = 'hello';
    const slot = outer.appendChild(document.createElement('div'));
    document.elementsFromPoint = vi.fn(() => [probe]);
    createCloneSource<null>({ onFrame, root: '.lk-lab__body' }).attach(slot, request());
    frame();
    frame();
    expect(slot.querySelector('.lk-lens-copy')?.childElementCount).toBe(0);
    expect(frames).toHaveLength(0);
  });
});
