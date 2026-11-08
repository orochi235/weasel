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

/** The root under `client`, skipping every lens's copy, found with the lens layer stood down. */
function rootAt(slot: HTMLElement, client: LoupePoint, selector: string): HTMLElement | null {
  const stack = probeUnderLens(
    slot,
    'beneath',
    () => document.elementsFromPoint?.(client.x, client.y) ?? [],
  );
  for (const el of stack) {
    if (el.closest(`[${COPY_ATTR}]`)) continue;
    const root = el.closest<HTMLElement>(selector);
    if (root) return root;
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

/** One lens cell's copy: which root it copies, the copy itself, and what keeps it current. */
class CloneCell {
  readonly box = document.createElement('div');
  private root: HTMLElement | null = null;
  private copy: Element | null = null;
  private readonly watch =
    typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => this.schedule());
  private stale = false;

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
      this.root = root;
      this.watch?.disconnect();
      if (root)
        this.watch?.observe(root, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        });
      this.recopy();
    }
    this.position();
  }

  detach(): void {
    this.watch?.disconnect();
    this.copy = null;
    this.box.remove();
  }

  private position(): void {
    const root = this.root;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    // Client px per root px: a zoomed pane draws its trial scaled.
    const scale = root.offsetWidth > 0 ? rect.width / root.offsetWidth : 1;
    const { reticle, factor, size } = this.request;
    const local = { x: (reticle.x - rect.left) / scale, y: (reticle.y - rect.top) / scale };
    const k = factor * scale;
    const set = (name: string, px: number) => this.box.style.setProperty(name, `${px}px`);
    set('--lk-copy-w', root.offsetWidth);
    set('--lk-copy-h', root.offsetHeight);
    set('--lk-copy-x', size.width / 2 - local.x * k);
    set('--lk-copy-y', size.height / 2 - local.y * k);
    this.box.style.setProperty('--lk-copy-k', String(k));
  }

  private recopy(): void {
    this.stale = false;
    const root = this.root;
    this.copy = root ? (root.cloneNode(true) as Element) : null;
    this.box.replaceChildren(...(this.copy ? [this.copy] : []));
    if (root && this.copy) copyCanvases(root, this.copy);
    this.want();
  }

  /** A change under the root recopies it on the next frame, once however many arrive before then. */
  private schedule(): void {
    this.stale = true;
    this.want();
  }

  /** Whether the next frame has work: a stale copy, or canvases, which repaint without any DOM change. */
  wants(): boolean {
    return this.copy !== null && (this.stale || this.copy.querySelector('canvas') !== null);
  }

  frame(): void {
    if (this.stale) this.recopy();
    else if (this.root && this.copy) copyCanvases(this.root, this.copy);
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
