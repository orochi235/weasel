import type { CanvasExtensionApi } from '@weasel-js/core';
import { createLoupeAimActions, type LoupeAimInput } from '@weasel-js/loupe';
import type { Action } from '@weasel-js/core';
import type { Hud } from '../hud';

/** The loupes built on each HUD, as what `loupe.aim` drives. */
const loupesByHud = new WeakMap<Hud, Set<LoupeAimInput>>();
/** The HUD attached to each surface, by {@link surfaceKey}. */
const hudBySurface = new WeakMap<object, Hud>();

/** List `input` among `hud`'s loupes; returns the unlisting. */
export function registerLoupe(hud: Hud, input: LoupeAimInput): () => void {
  let set = loupesByHud.get(hud);
  if (!set) loupesByHud.set(hud, (set = new Set()));
  set.add(input);
  return () => { set.delete(input); };
}

/** A surface by the element its input comes from, which every handle on it names alike. */
export function surfaceKey(api: Pick<CanvasExtensionApi, 'element' | 'surface'>): object {
  return api.element ?? api.surface ?? api;
}

/** Record `hud` as attached to `api`'s surface; returns the removal. */
export function recordHudOn(api: Pick<CanvasExtensionApi, 'element' | 'surface'>, hud: Hud): () => void {
  const key = surfaceKey(api);
  hudBySurface.set(key, hud);
  return () => { if (hudBySurface.get(key) === hud) hudBySurface.delete(key); };
}

/**
 * `loupe.aim` and `loupe.leave` for the HUD's contribution, driving the loupes on `hud`, or, for a contribution
 * built without one, on the HUD attached to each surface in `surfaces` (the ones it is installed on).
 */
export function loupeAimActions(hud: Hud | undefined, surfaces: ReadonlySet<object>): Action[] {
  const each = (fn: (input: LoupeAimInput) => void): void => {
    const huds = hud ? [hud] : [...surfaces].map((s) => hudBySurface.get(s));
    for (const h of huds) for (const input of (h && loupesByHud.get(h)) ?? []) fn(input);
  };
  const [aim, leave] = createLoupeAimActions({
    aimAt: (clientX, clientY, held) => each((input) => input.aimAt(clientX, clientY, held)),
    leave: () => each((input) => input.leave()),
  });
  return [aim, leave];
}
