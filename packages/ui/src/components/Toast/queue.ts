import { UNSTABLE_ToastQueue } from 'react-aria-components';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

/** Kit-owned payload rendered inside each toast. */
export interface ToastContent {
  title: string;
  description?: string;
  tone: ToastTone;
}

export interface ToastOptions {
  description?: string;
  /**
   * Auto-dismiss delay in ms. Default 8000. `null` — sticky until dismissed.
   * Must be > 0; RAC treats 0 as no timer (sticky).
   */
  ttlMs?: number | null;
  /** Stable identity: re-adding with the same id replaces the earlier toast. */
  id?: string;
}

const DEFAULT_TTL_MS = 8000;

// The wrapped RAC queue lives in a module-scoped WeakMap so the public
// class surface carries no RAC (UNSTABLE_) types — see the design spec's
// containment rule. `racQueueOf` below is the folder-internal accessor.
const RAC_QUEUES = new WeakMap<ToastQueue, UNSTABLE_ToastQueue<ToastContent>>();

/**
 * Kit-owned toast queue. Create isolated instances with
 * `createToastQueue()` (tests, secondary roots); most apps use the
 * module-level `defaultToastQueue` via `toast()`.
 *
 * At most 5 toasts are visible at once; adding a 6th shows immediately
 * and hides the oldest (it returns when a slot frees, with its ttl
 * restarted).
 */
export class ToastQueue {
  private keysById = new Map<string, string>();

  constructor() {
    RAC_QUEUES.set(this, new UNSTABLE_ToastQueue<ToastContent>({ maxVisibleToasts: 5 }));
  }

  add(tone: ToastTone, title: string, options: ToastOptions = {}): void {
    const { description, ttlMs = DEFAULT_TTL_MS, id } = options;
    const rac = RAC_QUEUES.get(this)!;
    if (id !== undefined) {
      const existing = this.keysById.get(id);
      if (existing !== undefined) rac.close(existing);
    }
    let key: string;
    const racOptions: { timeout?: number; onClose?: () => void } =
      ttlMs === null ? {} : { timeout: ttlMs };
    if (id !== undefined) {
      racOptions.onClose = () => {
        if (this.keysById.get(id) === key) this.keysById.delete(id);
      };
    }
    key = rac.add({ title, description, tone }, racOptions);
    if (id !== undefined) this.keysById.set(id, key);
  }

  /** Dismiss the toast previously added with this `id`. No-op if none is live. */
  dismiss(id: string): void {
    const key = this.keysById.get(id);
    if (key !== undefined) RAC_QUEUES.get(this)!.close(key);
  }

  /** Dismiss every queued toast. */
  clear(): void {
    RAC_QUEUES.get(this)!.clear();
    this.keysById.clear();
  }
}

export function createToastQueue(): ToastQueue {
  return new ToastQueue();
}

/**
 * Folder-internal bridge to the wrapped RAC queue for `ToastRegion`.
 * Deliberately NOT exported from the Toast folder's `index.ts` — the
 * RAC toast surface is unstable and must not leak past this folder.
 */
export function racQueueOf(queue: ToastQueue): UNSTABLE_ToastQueue<ToastContent> {
  return RAC_QUEUES.get(queue)!;
}

/** Module-level default queue used by `toast()` and `<ToastRegion>`. */
export const defaultToastQueue = createToastQueue();

type ToastFn = {
  (title: string, options?: ToastOptions): void;
  info(title: string, options?: ToastOptions): void;
  success(title: string, options?: ToastOptions): void;
  warning(title: string, options?: ToastOptions): void;
  error(title: string, options?: ToastOptions): void;
};

function tonedAdd(tone: ToastTone) {
  return (title: string, options?: ToastOptions) => defaultToastQueue.add(tone, title, options);
}

/** Imperative convenience over `defaultToastQueue`. Bare `toast(...)` is `info`. */
export const toast: ToastFn = Object.assign(tonedAdd('info'), {
  info: tonedAdd('info'),
  success: tonedAdd('success'),
  warning: tonedAdd('warning'),
  error: tonedAdd('error'),
});
