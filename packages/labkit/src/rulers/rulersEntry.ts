import type { ContributionDeps, RenderLayer, SurfaceContribution } from '@weasel-js/core';
import type { RulerHit, Rulers } from '@weasel-js/guides';
import type { TrialGuidesShown } from './types';

/** `layer` taking presses only as `shown` allows: none with the rulers off, and none on a hidden guide. */
function gated(layer: RenderLayer<unknown>, shown: () => TrialGuidesShown): RenderLayer<unknown> {
  const hitTest = layer.hitTest;
  if (!hitTest) return layer;
  return {
    ...layer,
    hitTest: (...args) => {
      const now = shown();
      if (!now.rulers) return null;
      const hit = hitTest(...args);
      const part = (hit?.initialScratch as RulerHit | undefined)?.part;
      return hit && part === 'guide' && !now.guides ? null : hit;
    },
  };
}

/**
 * `rulers`' contribution as a trial installs it, whatever is shown: it follows the view either way, and claims
 * presses only while the trial shows the rulers. `deps` are added to what it provides.
 */
export function trialRulersEntry(
  rulers: Rulers,
  shown: () => TrialGuidesShown,
  deps?: ContributionDeps,
): SurfaceContribution {
  const entry = rulers.contribution;
  return {
    ...entry,
    layers: (entry.layers ?? []).map((layer) => gated(layer, shown)),
    ...(deps ? { deps: { ...entry.deps, ...deps } } : {}),
  };
}
