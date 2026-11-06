import { BATCH_BUILDS, BATCH_FILL_LOCATIONS, batchFillWgsl } from './batchFill';
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

/** Every program the kit compiles, by the name its GLSL goes by. */
export const KIT_WGSL_PROGRAMS: readonly KitWgslProgram[] = [
  { name: 'pathFill', code: PATH_FILL_WGSL, locations: PATH_FILL_LOCATIONS, outputs: 'color+id' },
  { name: 'pathFillVColor', code: PATH_FILL_VCOLOR_WGSL, locations: PATH_FILL_VCOLOR_LOCATIONS, outputs: 'color+id' },
  { name: 'gradFill', code: GRAD_FILL_WGSL, locations: GRAD_FILL_LOCATIONS, outputs: 'color+id' },
  { name: 'patternFill', code: PATTERN_FILL_WGSL, locations: PATTERN_FILL_LOCATIONS, outputs: 'color+id' },
  { name: 'trimmedRibbon', code: TRIMMED_RIBBON_WGSL, locations: TRIMMED_RIBBON_LOCATIONS, outputs: 'color+id' },
  ...BATCH_BUILDS.map((b) => ({
    name: `batchFill(matrices=${b.matrices}, hulls=${b.hulls}, area=${b.area})`,
    code: batchFillWgsl(b), locations: BATCH_FILL_LOCATIONS, outputs: 'color+id' as const,
  })),
  { name: 'glyphPattern', code: GLYPH_PATTERN_WGSL, locations: GLYPH_PAINT_LOCATIONS, outputs: 'color+id' },
  { name: 'glyphGrad', code: GLYPH_GRAD_WGSL, locations: GLYPH_PAINT_LOCATIONS, outputs: 'color+id' },
  { name: 'glyphTexture', code: GLYPH_TEXTURE_WGSL, locations: GLYPH_PAINT_LOCATIONS, outputs: 'color+id' },
  { name: 'composite', code: COMPOSITE_WGSL, locations: COMPOSITE_LOCATIONS, outputs: 'color+id' },
  { name: 'idComposite', code: ID_COMPOSITE_WGSL, locations: ID_COMPOSITE_LOCATIONS, outputs: 'id' },
  { name: 'blur', code: assembleEffectWgsl(BLUR_EFFECT_WGSL), locations: EFFECT_LOCATIONS, outputs: 'color', effect: true },
  { name: 'vignette', code: assembleEffectWgsl(VIGNETTE_EFFECT_WGSL), locations: EFFECT_LOCATIONS, outputs: 'color', effect: true },
  { name: 'kit:mesh-gradient', code: MESH_WGSL, locations: MESH_LOCATIONS, outputs: 'color+id' },
  { name: 'test/own-draw', code: OWN_DRAW_WGSL, locations: OWN_DRAW_LOCATIONS, outputs: 'color+id' },
];
