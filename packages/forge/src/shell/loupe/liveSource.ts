import type { LensSource, LensSourceRequest } from '@weasel-js/labkit/loupe';
import type { Globals } from '../../protocol/messages';
import type { ForgeComparison, ResolveContext, ResolvedConditions } from './conditions';
import type { LiveLenses, LiveRequest } from './liveLenses';
import { frameAt, trialAt } from './trialAt';

export const NOTHING_UNDER = 'Nothing under the reticle';
export const NEEDS_FRAME = 'Live needs a frame for isolated stories';

/** The Live source, plus a way for its host to have every attached lens look again at what lies under it. */
export interface LiveSource extends LensSource<ForgeComparison> {
  /** Re-reads the trial under each lens: for a scroll, a resize, or a trial closing, none of which moves a reticle. */
  remeasure(): void;
}

/** The entries of `globals` that differ from `base`: what the comparison changes. */
function changes(globals: Globals, base: Globals): Globals {
  return Object.fromEntries(Object.entries(globals).filter(([key, value]) => base[key] !== value));
}

const sameGlobals = (a: Globals | null, b: Globals | null) =>
  a === b ||
  (a !== null && b !== null && Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v));

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
    sameGlobals(a.globals, b.globals)
  );
}

/**
 * A lens showing a second copy of the story under its reticle, rendered by that story's own trial into the lens.
 * `conditions` is read on every measure, so a comparison resolves against the lab as it is then.
 */
export function createLiveSource(
  lenses: LiveLenses,
  resolve: (c: ForgeComparison | null, base: Globals, ctx: ResolveContext) => ResolvedConditions,
  conditions: () => { base: Globals; ctx: ResolveContext },
): LiveSource {
  const measures = new Set<() => void>();
  return {
    kind: 'live',
    produces: 'dom',
    label: () => 'Live',
    status: () => true,
    subscribe: () => () => {},
    attach(slot, first) {
      const doc = slot.ownerDocument;
      const target = doc.createElement('div');
      target.className = 'fg-lens-live';
      const empty = doc.createElement('div');
      empty.className = 'fg-lens-live__empty';
      empty.hidden = true;
      slot.append(target, empty);
      let request: LensSourceRequest<ForgeComparison> = first;
      let posted: LiveRequest | null = null;
      const post = (next: LiveRequest | null) => {
        if (next === null ? posted === null : sameRequest(posted, next)) return;
        posted = next;

        lenses.set(request.lensId, next);
      };
      const measure = () => {

        const { lensId, reticle, conditions: compare } = request;
        const hit = trialAt(reticle, doc);
        empty.hidden = hit !== null;
        if (!hit) {
          post(null);
          empty.textContent = frameAt(reticle, doc) ? NEEDS_FRAME : NOTHING_UNDER;
          return;
        }
        const { base, ctx } = conditions();
        const resolved = resolve(compare, base, ctx);
        post({
          lensId,
          slot: target,
          hit,
          factor: request.factor,
          size: request.size,
          globals: compare === null ? null : changes(resolved.globals, base),
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
          measures.delete(measure);
          lenses.set(request.lensId, null);
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
