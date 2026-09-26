/**
 * The canvas's unit of extension: a routing `Contribution` plus the roles only
 * a surface can install — views on it, and whatever else needs the mounted
 * canvas.
 */
import { mergeContributions as mergeRoutingContributions } from '@weasel-js/routing';
import type { DepName, DepSchema } from 'interactions/actions/depSchema';
import type { Contribution } from '../tools/overlayBinding';
import type { CanvasExtensionApi } from './canvasExtension';
import type { CanvasViewProps } from './CanvasView';

/** Reads the surface's deps from inside `SurfaceContribution.attach`. */
export interface ContributionDepReader {
  get<K extends DepName>(name: K): DepSchema[K] | undefined;
}

/**
 * A feature a surface installs in one step. Every role is optional: `bindings`,
 * `actions`, `deps`, `overlay` and `presentation` from `Contribution`, plus
 * the two below. Installing it installs every role it declares, and removing
 * it removes them.
 */
export interface SurfaceContribution extends Contribution {
  /** Views this entry adds to the surface, as `<SceneCanvas views>` takes. */
  views?: readonly CanvasViewProps[];
  /**
   * Runs once the surface mounts; returns its teardown. For what the roles
   * above cannot say — a registered (hit-testable) layer, a subscription.
   *
   * Keyed by the function's identity, so a contribution built once (in a
   * `useMemo`, or at module scope) attaches once however often the host
   * re-renders.
   */
  attach?: (api: CanvasExtensionApi, deps: ContributionDepReader) => () => void;
}

/**
 * Concatenate contribution bundles into one registry, preserving order. Throws
 * on a duplicate entry id, dep name or view id — two features answering for
 * the same name is a bug in whichever was added second.
 */
export function mergeContributions<T extends SurfaceContribution>(
  ...bundles: readonly (readonly T[])[]
): T[] {
  const out = mergeRoutingContributions<T>(...bundles);
  const viewOwner = new Map<string, string>();
  for (const entry of out) {
    for (const view of entry.views ?? []) {
      const owner = viewOwner.get(view.id);
      if (owner !== undefined) {
        throw new Error(
          `mergeContributions: view "${view.id}" is added by both "${owner}" and "${entry.id}". `
          + `View ids are unique per surface; rename one.`,
        );
      }
      viewOwner.set(view.id, entry.id);
    }
  }
  return out;
}
