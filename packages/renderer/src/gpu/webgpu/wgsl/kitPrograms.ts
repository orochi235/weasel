import { BATCH_BUILDS, BATCH_FILL_LOCATIONS, batchFillWgsl, type BatchBuild } from './batchFill';
import { COMPOSITE_LOCATIONS, COMPOSITE_WGSL } from './composite';
import { assembleEffectWgsl } from './effectPrelude';
import { BLUR_EFFECT_WGSL, VIGNETTE_EFFECT_WGSL } from './effects';
import { GLYPH_GRAD_WGSL, GLYPH_PAINT_LOCATIONS, GLYPH_PATTERN_WGSL, GLYPH_TEXTURE_WGSL } from './glyphPaint';
import { GRAD_FILL_LOCATIONS, GRAD_FILL_WGSL } from './gradFill';
import { ID_COMPOSITE_LOCATIONS, ID_COMPOSITE_WGSL } from './idComposite';
import { MESH_LOCATIONS, MESH_WGSL } from './meshPaint';
import { OWN_DRAW_LOCATIONS, OWN_DRAW_WGSL } from './ownDrawPaint';
import { PATH_FILL_LOCATIONS, PATH_FILL_VCOLOR_LOCATIONS, PATH_FILL_VCOLOR_WGSL, PATH_FILL_WGSL } from './pathFill';
import { PATTERN_FILL_LOCATIONS, PATTERN_FILL_WGSL } from './patternFill';
import { TRIMMED_RIBBON_LOCATIONS, TRIMMED_RIBBON_WGSL } from './trimmedRibbon';

/** One kit WGSL module, with entry points `vs` and `fs` unless it is an effect
 *  (`weasel_vs`, `weasel_fs`), and its vertex attributes by location. */
export interface KitWgslProgram {
  readonly name: string;
  readonly code: string;
  readonly locations: Readonly<Record<string, number>>;
  /** Whether the fragment stage writes the id target at location 1 beside
   *  its color, writes it alone, or writes color alone. */
  readonly outputs: 'color+id' | 'id' | 'color';
  readonly effect?: boolean;
}

const EFFECT_LOCATIONS = { a_position: 0, a_uv: 1 } as const;

const kit = (name: string, code: string, locations: Readonly<Record<string, number>>,
  outputs: KitWgslProgram['outputs'] = 'color+id'): KitWgslProgram => ({ name, code, locations, outputs });

/** Every kit program's WGSL, under the name its GLSL goes by. */
export const KIT_WGSL = {
  pathFill: kit('pathFill', PATH_FILL_WGSL, PATH_FILL_LOCATIONS),
  pathFillVColor: kit('pathFillVColor', PATH_FILL_VCOLOR_WGSL, PATH_FILL_VCOLOR_LOCATIONS),
  gradFill: kit('gradFill', GRAD_FILL_WGSL, GRAD_FILL_LOCATIONS),
  patternFill: kit('patternFill', PATTERN_FILL_WGSL, PATTERN_FILL_LOCATIONS),
  trimmedRibbon: kit('trimmedRibbon', TRIMMED_RIBBON_WGSL, TRIMMED_RIBBON_LOCATIONS),
  glyphPattern: kit('glyphPattern', GLYPH_PATTERN_WGSL, GLYPH_PAINT_LOCATIONS),
  glyphGrad: kit('glyphGrad', GLYPH_GRAD_WGSL, GLYPH_PAINT_LOCATIONS),
  glyphTexture: kit('glyphTexture', GLYPH_TEXTURE_WGSL, GLYPH_PAINT_LOCATIONS),
  composite: kit('composite', COMPOSITE_WGSL, COMPOSITE_LOCATIONS),
  idComposite: kit('idComposite', ID_COMPOSITE_WGSL, ID_COMPOSITE_LOCATIONS, 'id'),
  blur: { ...kit('blur', assembleEffectWgsl(BLUR_EFFECT_WGSL), EFFECT_LOCATIONS, 'color'), effect: true },
  vignette: { ...kit('vignette', assembleEffectWgsl(VIGNETTE_EFFECT_WGSL), EFFECT_LOCATIONS, 'color'), effect: true },
  mesh: kit('kit:mesh-gradient', MESH_WGSL, MESH_LOCATIONS),
  ownDraw: kit('test/own-draw', OWN_DRAW_WGSL, OWN_DRAW_LOCATIONS),
} as const satisfies Record<string, KitWgslProgram>;

/** The batch program's build for `build`. */
export function batchFillProgram(build: BatchBuild): KitWgslProgram {
  return kit(`batchFill(matrices=${build.matrices}, hulls=${build.hulls}, area=${build.area})`, batchFillWgsl(build),
    BATCH_FILL_LOCATIONS);
}

/** Every module above and every batch build, for a test over them all. */
export const KIT_WGSL_PROGRAMS: readonly KitWgslProgram[] = [...Object.values(KIT_WGSL), ...BATCH_BUILDS.map(batchFillProgram)];
