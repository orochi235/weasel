import type { GpuDevice } from '../gpu/types';
import type { ShaderProgram } from './ShaderProgram';
import {
  VERT_SRC,
  FRAG_SRC,
  VCOLOR_VERT_SRC,
  VCOLOR_FRAG_SRC,
  PATH_FILL_UNIFORMS,
  PATH_FILL_ATTRIBUTES,
  PATH_FILL_VCOLOR_ATTRIBUTES,
} from './pathFill';
import {
  BATCH_VERT_SRC,
  BATCH_AREA_VERT_SRC,
  BATCH_FRAG_SRC,
  BATCH_MATRICES_FRAG_SRC,
  BATCH_HULL_FRAG_SRC,
  BATCH_MATRICES_HULL_FRAG_SRC,
  batchAreaFragSrc,
  BATCH_FILL_UNIFORMS,
  BATCH_HULL_UNIFORMS,
  BATCH_FILL_ATTRIBUTES,
  BATCH_TEXTURE_SLOTS,
} from './batchFill';
import {
  GRAD_VERT_SRC,
  GRAD_FRAG_SRC,
  GRAD_FILL_UNIFORMS,
  GRAD_FILL_ATTRIBUTES,
} from './gradFill';
import {
  TRIMMED_RIBBON_VERT_SRC, TRIMMED_RIBBON_FRAG_SRC, TRIMMED_RIBBON_UNIFORMS, TRIMMED_RIBBON_ATTRIBUTES,
} from './trimmedRibbon';
import {
  PATTERN_VERT_SRC,
  PATTERN_FRAG_SRC,
  PATTERN_FILL_UNIFORMS,
  PATTERN_FILL_ATTRIBUTES,
} from './patternFill';

import { KIT_WGSL, batchFillProgram } from '../gpu/webgpu/wgsl/kitPrograms';
import type { BatchBuild } from '../gpu/webgpu/wgsl/batchFill';
import {
  GLYPH_PAINT_VERT_SRC, GLYPH_PATTERN_FRAG_SRC, GLYPH_GRAD_FRAG_SRC, GLYPH_TEXTURE_FRAG_SRC,
  GLYPH_PATTERN_UNIFORMS, GLYPH_GRAD_UNIFORMS, GLYPH_TEXTURE_UNIFORMS, GLYPH_PAINT_ATTRIBUTES,
} from './glyphPaint';
import type { GlyphPaintKind } from '../draw/drawContext';

/** What a built-in program is built from: its GLSL stages, its WGSL module,
 *  and the names its GLSL is written through. */
export interface ProgramSpec {
  readonly vert: string;
  readonly frag: string;
  readonly wgsl: string;
  readonly uniforms: readonly string[];
  readonly attributes: readonly string[];
  readonly arrays?: ReadonlyMap<string, { type: string; size: number }>;
}

/** The batch's sampler array, which a flush fills slot by slot. */
const BATCH_ARRAYS: ReadonlyMap<string, { type: string; size: number }> = new Map([
  ['u_samplers', { type: 'sampler2D', size: BATCH_TEXTURE_SLOTS }],
]);

/** `spec` compiled on `gpu`, every name it is written through looked up. */
function buildProgram(gpu: GpuDevice, spec: ProgramSpec): ShaderProgram {
  const { vert, frag, wgsl, uniforms, attributes, arrays } = spec;
  const program = gpu.createProgram({ glsl: { vert, frag }, wgsl });
  program.lookupUniforms(uniforms);
  if (arrays) program.lookupUniformArrays(arrays);
  program.lookupAttributes(attributes);
  return program;
}

/**
 * A built-in program compiled the first time a frame draws with it, so a
 * renderer whose frames never fill a path with a pattern never builds the
 * pattern program.
 */
export class LazyProgram {
  private program: ShaderProgram | null = null;

  constructor(private readonly gpu: GpuDevice, private readonly spec: ProgramSpec) {}

  get(): ShaderProgram {
    this.program ??= buildProgram(this.gpu, this.spec);
    return this.program;
  }

  /** Delete the program if it was built. It builds again on the next `get`. */
  release(): void {
    if (this.program) this.gpu.deleteProgram(this.program);
    this.program = null;
  }

  /** Forget a program its lost context already took with it. */
  abandon(): void {
    this.program = null;
  }
}

export const PATH_FILL_SPEC: ProgramSpec = {
  vert: VERT_SRC, frag: FRAG_SRC, wgsl: KIT_WGSL.pathFill.code, uniforms: PATH_FILL_UNIFORMS,
  attributes: PATH_FILL_ATTRIBUTES,
};
export const PATH_FILL_VCOLOR_SPEC: ProgramSpec = {
  vert: VCOLOR_VERT_SRC, frag: VCOLOR_FRAG_SRC, wgsl: KIT_WGSL.pathFillVColor.code, uniforms: PATH_FILL_UNIFORMS,
  attributes: PATH_FILL_VCOLOR_ATTRIBUTES,
};
export const GRAD_FILL_SPEC: ProgramSpec = {
  vert: GRAD_VERT_SRC, frag: GRAD_FRAG_SRC, wgsl: KIT_WGSL.gradFill.code, uniforms: GRAD_FILL_UNIFORMS,
  attributes: GRAD_FILL_ATTRIBUTES,
};
/** The batch program's build under `frag`, named as `batchFillProgram` names it. */
function batchSpec(vert: string, frag: string, build: BatchBuild): ProgramSpec {
  return {
    vert, frag, wgsl: batchFillProgram(build).code, uniforms: build.hulls ? BATCH_HULL_UNIFORMS : BATCH_FILL_UNIFORMS,
    attributes: BATCH_FILL_ATTRIBUTES, arrays: BATCH_ARRAYS,
  };
}
export const BATCH_FILL_MATRICES_SPEC = batchSpec(BATCH_VERT_SRC, BATCH_MATRICES_FRAG_SRC, { matrices: true, hulls: false, area: false });
const BATCH_FILL_HULL_SPEC = batchSpec(BATCH_VERT_SRC, BATCH_HULL_FRAG_SRC, { matrices: false, hulls: true, area: false });
const BATCH_FILL_MATRICES_HULL_SPEC = batchSpec(BATCH_VERT_SRC, BATCH_MATRICES_HULL_FRAG_SRC, { matrices: true, hulls: true, area: false });
const TRIMMED_RIBBON_SPEC: ProgramSpec = {
  vert: TRIMMED_RIBBON_VERT_SRC, frag: TRIMMED_RIBBON_FRAG_SRC, wgsl: KIT_WGSL.trimmedRibbon.code,
  uniforms: TRIMMED_RIBBON_UNIFORMS, attributes: TRIMMED_RIBBON_ATTRIBUTES,
};
export const PATTERN_FILL_SPEC: ProgramSpec = {
  vert: PATTERN_VERT_SRC, frag: PATTERN_FRAG_SRC, wgsl: KIT_WGSL.patternFill.code, uniforms: PATTERN_FILL_UNIFORMS,
  attributes: PATTERN_FILL_ATTRIBUTES,
};

/** Each glyph-paint program: atlas text masking a paint the batch cannot carry. */
export const GLYPH_PAINT_SPECS: Readonly<Record<GlyphPaintKind, ProgramSpec>> = {
  pattern: {
    vert: GLYPH_PAINT_VERT_SRC, frag: GLYPH_PATTERN_FRAG_SRC, wgsl: KIT_WGSL.glyphPattern.code,
    uniforms: GLYPH_PATTERN_UNIFORMS, attributes: GLYPH_PAINT_ATTRIBUTES,
  },
  gradient: {
    vert: GLYPH_PAINT_VERT_SRC, frag: GLYPH_GRAD_FRAG_SRC, wgsl: KIT_WGSL.glyphGrad.code,
    uniforms: GLYPH_GRAD_UNIFORMS, attributes: GLYPH_PAINT_ATTRIBUTES,
  },
  texture: {
    vert: GLYPH_PAINT_VERT_SRC, frag: GLYPH_TEXTURE_FRAG_SRC, wgsl: KIT_WGSL.glyphTexture.code,
    uniforms: GLYPH_TEXTURE_UNIFORMS, attributes: GLYPH_PAINT_ATTRIBUTES,
  },
};

/** Built eagerly: nearly every frame draws with it, and `DrawBatch` binds its
 *  attributes at construction. */
export function createBatchFill(gpu: GpuDevice): ShaderProgram {
  return buildProgram(gpu, batchSpec(BATCH_VERT_SRC, BATCH_FRAG_SRC, { matrices: false, hulls: false, area: false }));
}

/** The batch program's other builds, which a run picks by what it holds, and
 *  the trimmed ribbon's, which draws beside the batch. */
export interface BatchVariants {
  /**
   * Whether a run may hold a hull clip: only where the default framebuffer
   * takes one sample a pixel, which is where the shader's decision is exact
   * (`batchHull.ts`).
   */
  readonly hulls: boolean;
  /**
   * Whether the CPU cuts what the stencil would otherwise: where `hulls` is
   * off, a convex clip and a slanted edge across a rect clip (`batchClip.ts`),
   * and anywhere, an aligned stroke (`alignedRibbon.ts`).
   * Always on but in a test that wants the stencil as its reference.
   */
  readonly cuts: boolean;
  /**
   * Whether an opaque trimmed stroke too large to batch clips its cached
   * ribbon in the shader (`draw/clippedTrim.ts`) rather than rebuilding it
   * trimmed. Always on but in a test that wants the rebuild as its reference.
   */
  readonly trimClip: boolean;
  /** The program that clip draws with (`shaders/trimmedRibbon.ts`). */
  trimmedRibbon(): ShaderProgram;
  /** The build for a run under several color matrices, holding a hull, or
   *  holding glyphs that need area coverage, in any combination. A run with
   *  none of them draws with `createBatchFill`'s. */
  get(matrices: boolean, hulls: boolean, area?: boolean): ShaderProgram;
}

/** `BatchVariants` over this context, each build compiled the first time a
 *  run needs it. */
export class BatchVariantPrograms implements BatchVariants {
  readonly hulls: boolean;
  readonly cuts = true;
  readonly trimClip = true;
  private readonly trimmed: LazyProgram;
  private readonly matrices: LazyProgram;
  private readonly hull: LazyProgram;
  private readonly matricesHull: LazyProgram;
  /** Indexed by `matrices + 2 * hulls`. */
  private readonly area: LazyProgram[];

  constructor(gpu: GpuDevice) {
    this.hulls = gpu.limits.samples === 0;
    this.matrices = new LazyProgram(gpu, BATCH_FILL_MATRICES_SPEC);
    this.hull = new LazyProgram(gpu, BATCH_FILL_HULL_SPEC);
    this.matricesHull = new LazyProgram(gpu, BATCH_FILL_MATRICES_HULL_SPEC);
    this.trimmed = new LazyProgram(gpu, TRIMMED_RIBBON_SPEC);
    this.area = [false, true].flatMap((hulls) => [false, true].map((matrices) => new LazyProgram(gpu,
      batchSpec(BATCH_AREA_VERT_SRC, batchAreaFragSrc(matrices, hulls), { matrices, hulls, area: true }))));
  }

  get(matrices: boolean, hulls: boolean, area = false): ShaderProgram {
    if (area) return this.area[Number(matrices) + 2 * Number(hulls)].get();
    if (!hulls) return this.matrices.get();
    return (matrices ? this.matricesHull : this.hull).get();
  }

  trimmedRibbon(): ShaderProgram {
    return this.trimmed.get();
  }

  lazy(): LazyProgram[] {
    return [this.matrices, this.hull, this.matricesHull, this.trimmed, ...this.area];
  }
}
