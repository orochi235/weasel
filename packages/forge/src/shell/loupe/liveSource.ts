import type { LensSource, LensSourceRequest } from '@weasel-js/labkit/loupe';
import type { Globals } from '../../protocol/messages';
import type { ForgeComparison, ResolveContext, ResolvedConditions } from './conditions';
import type { LiveLenses, LiveRequest } from './liveLenses';
import { trialAt } from './trialAt';

export const NOTHING_UNDER = 'Nothing under the reticle';

/** The Live source, plus a way for its host to have every attached lens look again at what lies under it. */
export interface LiveSource extends LensSource<ForgeComparison> {
  /** Re-reads the trial under each lens: for a scroll, a resize, or a trial closing, none of which moves a reticle. */
  remeasure(): void;
}

const sameContext = (a: ResolveContext, b: ResolveContext) =>
  a.declarations === b.declarations && a.modeGlobal === b.modeGlobal && a.prefersDark === b.prefersDark && a.labMode === b.labMode;

/** The id a lens cell asks under: a cell showing a comparison is a request of its own beside the lens's story. */
export const liveCellId = (lensId: string, compare: ForgeComparison | null): string =>
  compare === null ? lensId : `${lensId}~compared`;

/** Whether `b` would render the copy `a` does: a measure that finds nothing new posts nothing. */
function sameRequest(a: LiveRequest | null, b: LiveRequest): boolean {
  return (
    a !== null &&
    a.slot === b.slot &&
    a.hit.host === b.hit.host &&
    a.hit.trialId === b.hit.trialId &&
    a.hit.local.x === b.hit.local.x &&
    a.hit.local.y === b.hit.local.y &&
    a.hit.scale === b.hit.scale &&
    a.factor === b.factor &&
    a.size.width === b.size.width &&
    a.size.height === b.size.height &&
    a.args === b.args &&
    a.compare === b.compare &&
    sameContext(a.ctx, b.ctx)
  );
}

/** What changes a story's look without moving its DOM: a hover, a focus, a transition ending. */
const LOOK_EVENTS = ['pointerover', 'pointerout', 'focusin', 'focusout', 'transitionend'] as const;

/** Calls `notify` whenever the element it is pointed at changes; pointing it at null stops it. */
function watchOf(notify: () => void): (el: HTMLElement | null) => void {
  const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(notify);
  let watched: HTMLElement | null = null;
  return (el) => {
    if (el === watched) return;
    observer?.disconnect();
    for (const type of LOOK_EVENTS) watched?.removeEventListener(type, notify);
    watched = el;
    if (!el) return;
    observer?.observe(el, { subtree: true, childList: true, characterData: true, attributes: true });
    for (const type of LOOK_EVENTS) el.addEventListener(type, notify);
  };
}

const now = (run: () => void) => run();

/**
 * A lens showing a second copy of the story under its reticle, rendered by that story's own trial into the lens.
 * `conditions` is read on every measure, so a comparison resolves against the lab as it is then. `schedule` runs the
 * readers' notification: every change it gathers before running is one notification. The default runs it at once.
 */
export function createLiveSource(
  lenses: LiveLenses,
  resolve: (c: ForgeComparison | null, base: Globals, ctx: ResolveContext) => ResolvedConditions,
  conditions: () => { base: Globals; ctx: ResolveContext },
  schedule: (run: () => void) => void = now,
): LiveSource {
  const measures = new Set<() => void>();
  const listeners = new Set<() => void>();
  let due = false;
  const flush = () => {
    due = false;
    for (const listener of [...listeners]) listener();
  };
  const notify = () => {
    if (due) return;
    due = true;
    schedule(flush);
  };
  return {
    kind: 'live',
    produces: 'dom',
    label: () => 'Live',
    status: () => true,
    // A reader hears of what it reads: the lens's copy, and with nothing compared, the main story under the reticle.
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    attach(slot, first) {
      const doc = slot.ownerDocument;
      const target = doc.createElement('div');
      target.className = 'fg-lens-live';
      const empty = doc.createElement('div');
      empty.className = 'fg-lens-empty';
      empty.hidden = true;
      slot.append(target, empty);
      const watchCopy = watchOf(notify);
      watchCopy(target);
      const watchStory = watchOf(notify);
      let request: LensSourceRequest<ForgeComparison> = first;
      let posted: LiveRequest | null = null;
      const post = (next: LiveRequest | null) => {
        if (next === null ? posted === null : sameRequest(posted, next)) return;
        posted = next;
        lenses.set(liveCellId(request.lensId, request.conditions), next);
      };
      const measure = () => {
        const { lensId, reticle, conditions: compare } = request;
        const hit = trialAt(reticle, doc);
        watchStory(compare === null ? (hit?.host ?? null) : null);
        empty.hidden = hit !== null;
        if (!hit) {
          post(null);
          empty.textContent = NOTHING_UNDER;
          return;
        }
        const { base, ctx } = conditions();
        const resolved = resolve(compare, base, ctx);
        post({
          lensId: liveCellId(lensId, compare),
          slot: target,
          hit,
          factor: request.factor,
          size: request.size,
          compare,
          ctx,
          args: resolved.args,
        });
      };
      measures.add(measure);
      measure();
      return {
        update(next) {
          request = next;
          measure();
        },
        detach() {
          watchCopy(null);
          watchStory(null);
          measures.delete(measure);
          lenses.set(liveCellId(request.lensId, request.conditions), null);
          target.remove();
          empty.remove();
        },
      };
    },
    remeasure() {
      for (const measure of [...measures]) measure();
    },
  };
}
