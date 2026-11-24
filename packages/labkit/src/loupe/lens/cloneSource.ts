import { layoutBoxOf } from '@weasel-js/core';
import type { LensSource, LensSourceHandle, LensSourceRequest } from './lensSource';
import type { LoupePoint } from './lensTypes';
import { probeUnderLens } from './probeUnderLens';
import type { Remeasurable } from './useLensRemeasure';

/** Options for {@link createCloneSource}. */
export interface CloneSourceOptions {
  /** Runs a function on the next visible frame, once however many arrive before then: `useFrameSchedule`'s. */
  onFrame: (run: () => void) => void;
  /** What a lens copies: the nearest ancestor of the point under its reticle matching this. Default a trial's body. */
  root?: string;
}

/** A Live source that copies the DOM under each reticle into the lens, and can be told to look again. */
export interface CloneSource<C> extends LensSource<C>, Remeasurable {}

/** Marks a copy, so a hit test under a lens never lands on another lens's copy. */
const COPY_ATTR = 'data-lk-copy';

/** The root under `client`, skipping every lens's copy and any root holding the lens itself, which would copy its own
 *  copy on every frame; found with the lens layer stood down. */
function rootAt(slot: HTMLElement, client: LoupePoint, selector: string): HTMLElement | null {
  const stack = probeUnderLens(
    slot,
    'beneath',
    () => document.elementsFromPoint?.(client.x, client.y) ?? [],
  );
  for (const el of stack) {
    if (el.closest(`[${COPY_ATTR}]`)) continue;
    const root = el.closest<HTMLElement>(selector);
    if (root && !root.contains(slot)) return root;
  }
  return null;
}

/** Paints each canvas in `copy` with what the canvas at the same place in `root` shows now. */
function copyCanvases(root: HTMLElement, copy: Element): void {
  const from = root.querySelectorAll('canvas');
  const to = copy.querySelectorAll('canvas');
  from.forEach((source, i) => {
    const target = to[i];
    if (!target || source.width === 0 || source.height === 0) return;
    if (target.width !== source.width) target.width = source.width;
    if (target.height !== source.height) target.height = source.height;
    const ctx = target.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(source, 0, 0);
  });
}

/** Gives each element in `copy` the scroll offsets and control state of the element at the same place in `root`:
 *  none of these is in the markup a clone copies, and none of them changes it. */
function mirrorState(root: Element, copy: Element): void {
  const from = [root, ...root.querySelectorAll('*')];
  const to = [copy, ...copy.querySelectorAll('*')];
  from.forEach((source, i) => {
    const target = to[i];
    if (!target) return;
    if (target.scrollTop !== source.scrollTop) target.scrollTop = source.scrollTop;
    if (target.scrollLeft !== source.scrollLeft) target.scrollLeft = source.scrollLeft;
    if (source instanceof HTMLInputElement && target instanceof HTMLInputElement) {
      if (source.type.toLowerCase() !== 'file' && target.value !== source.value)
        target.value = source.value;
      target.checked = source.checked;
      target.indeterminate = source.indeterminate;
    } else if (source instanceof HTMLTextAreaElement && target instanceof HTMLTextAreaElement) {
      if (target.value !== source.value) target.value = source.value;
    } else if (source instanceof HTMLOptionElement && target instanceof HTMLOptionElement) {
      target.selected = source.selected;
    }
  });
}

/** Events after which a root's scroll offsets or control state may differ from its copy's. */
const STATE_EVENTS = ['scroll', 'input', 'change'] as const;

/**
 * Takes the live behavior out of a copy before it is connected: a named radio would join the trial's own radio group
 * and uncheck its checked one, a control naming a form by `form` would be submitted with the trial's, an id would
 * answer the trial's own `getElementById`, `for` and `url(#…)` lookups, a frame, object or embed would load its page
 * again, and autoplaying media would start a second time.
 */
function stillCopy(copy: Element): void {
  for (const el of [copy, ...copy.querySelectorAll('[id]')]) el.removeAttribute('id');
  for (const radio of copy.querySelectorAll<HTMLInputElement>('input[type="radio" i][name]'))
    radio.removeAttribute('name');
  for (const control of copy.querySelectorAll('[form]')) control.removeAttribute('form');
  for (const frame of copy.querySelectorAll('iframe, frame, embed')) {
    frame.removeAttribute('src');
    frame.removeAttribute('srcdoc');
  }
  for (const object of copy.querySelectorAll('object')) object.removeAttribute('data');
  for (const media of copy.querySelectorAll('[autoplay]')) media.removeAttribute('autoplay');
}

/** One lens cell's copy: which root it copies, the copy itself, and what keeps it current. */
class CloneCell {
  readonly box = document.createElement('div');
  private root: HTMLElement | null = null;
  private copy: Element | null = null;
  private readonly watch =
    typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => this.schedule());
  private readonly sizes =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.position());
  private stale = false;
  /** Scroll offsets or control state have changed since the copy last mirrored them. */
  private drifted = false;
  private readonly onState = () => {
    this.drifted = true;
    this.want();
  };

  constructor(
    private readonly slot: HTMLElement,
    private request: LensSourceRequest<unknown>,
    private readonly selector: string,
    /** Asks the source for a frame, on which it calls {@link frame}. */
    private readonly want: () => void,
  ) {
    this.box.className = 'lk-lens-copy';
    this.box.setAttribute(COPY_ATTR, '');
    this.box.inert = true;
    slot.append(this.box);
    this.place();
  }

  update(request: LensSourceRequest<unknown>): void {
    this.request = request;
    this.place();
  }

  /** Finds the root under the reticle again, copying it afresh when it is a different one, and centers the copy. */
  place(): void {
    const root = rootAt(this.slot, this.request.reticle, this.selector);
    if (root !== this.root) {
      this.unwatch();
      this.root = root;
      if (root) {
        this.watch?.observe(root, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        });
        this.sizes?.observe(root);
        for (const type of STATE_EVENTS) root.addEventListener(type, this.onState, true);
      }
      this.recopy();
    }
    this.position();
  }

  detach(): void {
    this.unwatch();
    this.root = null;
    this.copy = null;
    this.box.remove();
  }

  private unwatch(): void {
    this.watch?.disconnect();
    this.sizes?.disconnect();
    for (const type of STATE_EVENTS) this.root?.removeEventListener(type, this.onState, true);
  }

  private position(): void {
    const root = this.root;
    if (!root) return;
    // A zoomed pane draws its trial scaled.
    const { left, top, scale } = layoutBoxOf(root);
    const { reticle, factor, size } = this.request;
    const local = { x: (reticle.x - left) / scale.x, y: (reticle.y - top) / scale.y };
    const kx = factor * scale.x;
    const ky = factor * scale.y;
    const set = (name: string, px: number) => this.box.style.setProperty(name, `${px}px`);
    set('--lk-copy-w', root.offsetWidth);
    set('--lk-copy-h', root.offsetHeight);
    set('--lk-copy-x', size.width / 2 - local.x * kx);
    set('--lk-copy-y', size.height / 2 - local.y * ky);
    this.box.style.setProperty('--lk-copy-kx', String(kx));
    this.box.style.setProperty('--lk-copy-ky', String(ky));
  }

  private recopy(): void {
    this.stale = false;
    const root = this.root;
    this.copy = root ? (root.cloneNode(true) as Element) : null;
    if (this.copy) stillCopy(this.copy);
    this.box.replaceChildren(...(this.copy ? [this.copy] : []));
    this.drifted = false;
    if (root && this.copy) {
      copyCanvases(root, this.copy);
      mirrorState(root, this.copy);
    }
    this.position();
    this.want();
  }

  /** A change under the root recopies it on the next frame, once however many arrive before then. */
  private schedule(): void {
    this.stale = true;
    this.want();
  }

  /** Whether the next frame has work: a stale copy, or canvases, which repaint without any DOM change. */
  wants(): boolean {
    return (
      this.copy !== null &&
      (this.stale || this.drifted || this.copy.querySelector('canvas') !== null)
    );
  }

  frame(): void {
    if (this.stale) this.recopy();
    else if (this.root && this.copy) {
      copyCanvases(this.root, this.copy);
      if (this.drifted) {
        this.drifted = false;
        mirrorState(this.root, this.copy);
      }
    }
  }
}

/**
 * The Live source a lab offers when its host offers none: each lens shows a copy of the DOM under its reticle, scaled
 * by the lens's factor. SVG and text stay sharp at any factor; a canvas is copied pixel for pixel, so it magnifies
 * blocky, and a WebGL canvas that does not preserve its drawing buffer copies blank.
 */
export function createCloneSource<C>(options: CloneSourceOptions): CloneSource<C> {
  const selector = options.root ?? '.lk-trial__body';
  const cells = new Set<CloneCell>();
  const flush = () => {
    for (const cell of cells) if (cell.wants()) cell.frame();
    if ([...cells].some((cell) => cell.wants())) options.onFrame(flush);
  };
  const want = () => options.onFrame(flush);
  return {
    kind: 'live',
    produces: 'dom',
    label: () => 'Live',
    status: () => true,
    subscribe: () => () => {},
    attach(slot, request): LensSourceHandle<C> {
      const cell = new CloneCell(slot, request as LensSourceRequest<unknown>, selector, want);
      cells.add(cell);
      return {
        update: (next) => cell.update(next as LensSourceRequest<unknown>),
        detach: () => {
          cells.delete(cell);
          cell.detach();
        },
      };
    },
    remeasure() {
      for (const cell of cells) cell.place();
    },
  };
}
