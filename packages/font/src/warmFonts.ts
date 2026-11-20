import { variantKey } from './variantKey';
import { chainPick, farPick } from './familyFace';
import { normalizeVariant, type FontStyle } from './fontStyle';
import { isExplicitCanvasFont } from './dynamic/dynamicAtlas';
import { getFontFallbackPolicy, getDefaultFontFamily } from './fallback';
import { hasFontOutlines, loadFontOutlines } from './outline/outlineRegistry';
import {
  atlasPending, familyLoads, firstRegisteredFamily, fontRegistry, isRegisteredFamily, registeredFamilyNames,
  variantKeysOf, variantLoad, wakeFamily, wakeVariant,
} from './registerFont';

/** One face text is set in, the way a render asks for it — what
 *  {@link warmFonts} takes to load that face and nothing else. Weight
 *  defaults to 400 and style to `'normal'`. */
export interface FontRequest {
  family: string;
  weight?: number;
  style?: FontStyle;
}

/**
 * Load registered atlases ahead of their first use, so a synchronous render —
 * `renderSceneToPixels`, an export, a print — draws text set in a lazily
 * registered face rather than nothing. With no list, loads every family
 * `registerFont` was called for.
 *
 * A family name loads every variant registered for it. A {@link FontRequest}
 * loads what resolving that one variant would draw with: the variant of the
 * family the within-family chain lands on, the family the `'substitute'`
 * policy would draw instead when the requested one has no atlas face, and the
 * variant's outline face when one is registered.
 *
 * Resolves once they have all landed; a registered variant counts as loaded.
 * Rejects when a load fails, or for a family name `registerFont` never saw —
 * a {@link FontRequest} for such a family is not an error, since the canvas
 * and outline tiers serve families no atlas was registered for.
 */
export function warmFonts(fonts?: readonly (string | FontRequest)[]): Promise<void> {
  const pending: Promise<unknown>[] = [];
  for (const font of fonts ?? registeredFamilyNames()) {
    if (typeof font !== 'string') {
      const { weight, style } = normalizeVariant(font);
      pending.push(...variantLoads(font.family, weight, style));
      continue;
    }
    if (!isRegisteredFamily(font)) {
      return Promise.reject(new Error(`weasel warmFonts: "${font}" was never registered.`));
    }
    wakeFamily(font);
    pending.push(...familyLoads(font));
  }
  return Promise.all(pending).then(() => undefined);
}

/** The loads `(family, weight, style)` resolves through, started — the same
 *  tiers, in the same order, as `resolveFontVariantInternal`. */
function variantLoads(family: string, weight: number, style: FontStyle): Promise<unknown>[] {
  const out: Promise<unknown>[] = [];
  const outlines = hasFontOutlines(family, weight, style);
  if (outlines) out.push(loadFontOutlines(family, { weight, style }));
  if (fontRegistry.get(family)?.has(variantKey(weight, style))) return out;
  const keys = variantKeysOf(family);
  const near = chainPick(keys, weight, style);
  if (near) return [...out, ...pickedLoad(family, near.key)];
  if (outlines || isExplicitCanvasFont(family)) return out;
  const far = farPick(keys, weight, style);
  if (far) return [...out, ...pickedLoad(family, far.key)];
  if (atlasPending(family)) return [...out, ...familyLoads(family)];
  if (getFontFallbackPolicy() !== 'substitute') return out;
  const fallback = getDefaultFontFamily() ?? firstRegisteredFamily();
  return fallback !== null && fallback !== family ? [...out, ...variantLoads(fallback, weight, style)] : out;
}

/** The load of the variant the chain picked, started if it was only declared. */
function pickedLoad(family: string, key: string): Promise<void>[] {
  wakeVariant(family, key);
  const load = variantLoad(family, key);
  return load ? [load] : [];
}
