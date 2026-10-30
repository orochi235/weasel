import { ShaderProgram } from './ShaderProgram';
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
  BATCH_FRAG_SRC,
  BATCH_MATRICES_FRAG_SRC,
  BATCH_HULL_FRAG_SRC,
  BATCH_MATRICES_HULL_FRAG_SRC,
  batchAreaFragSrc,
  BATCH_FILL_UNIFORMS,
  BATCH_HULL_UNIFORMS,
  BATCH_FILL_ATTRIBUTES,
} from './batchFill';
import {
  GRAD_VERT_SRC,
  GRAD_FRAG_SRC,
  GRAD_FILL_UNIFORMS,
  GRAD_FILL_ATTRIBUTES,
} from './gradFill';
import {
  PATTERN_VERT_SRC,
  PATTERN_FRAG_SRC,
  PATTERN_FILL_UNIFORMS,
  PATTERN_FILL_ATTRIBUTES,
} from './patternFill';

/** What a built-in program is built from. */
export interface ProgramSpec {
  readonly vert: string;
  readonly frag: string;
  readonly uniforms: readonly string[];
  readonly attributes: readonly string[];
}

/**
 * A built-in program compiled the first time a frame draws with it, so a
 * renderer whose frames never fill a path with a pattern never builds the
 * pattern program.
 */
export class LazyProgram {
  private program: ShaderProgram | null = null;

  constructor(private readonly gl: WebGL2RenderingContext, private readonly spec: ProgramSpec) {}

  get(): ShaderProgram {
    if (!this.program) {
      const { vert, frag, uniforms, attributes } = this.spec;
      const program = new ShaderProgram(this.gl, vert, frag);
      program.lookupUniforms(uniforms);
      program.lookupAttributes(attributes);
      this.program = program;
    }
    return this.program;
  }

  /** Delete the program if it was built. It builds again on the next `get`. */
  release(): void {
    if (this.program) this.gl.deleteProgram(this.program.handle);
    this.program = null;
  }

  /** Forget a program its lost context already took with it. */
  abandon(): void {
    this.program = null;
  }
}

export const PATH_FILL_SPEC: ProgramSpec = {
  vert: VERT_SRC, frag: FRAG_SRC, uniforms: PATH_FILL_UNIFORMS, attributes: PATH_FILL_ATTRIBUTES,
};
export const PATH_FILL_VCOLOR_SPEC: ProgramSpec = {
  vert: VCOLOR_VERT_SRC, frag: VCOLOR_FRAG_SRC, uniforms: PATH_FILL_UNIFORMS, attributes: PATH_FILL_VCOLOR_ATTRIBUTES,
};
export const GRAD_FILL_SPEC: ProgramSpec = {
  vert: GRAD_VERT_SRC, frag: GRAD_FRAG_SRC, uniforms: GRAD_FILL_UNIFORMS, attributes: GRAD_FILL_ATTRIBUTES,
};
export const BATCH_FILL_MATRICES_SPEC: ProgramSpec = {
  vert: BATCH_VERT_SRC, frag: BATCH_MATRICES_FRAG_SRC, uniforms: BATCH_FILL_UNIFORMS, attributes: BATCH_FILL_ATTRIBUTES,
};
const BATCH_FILL_HULL_SPEC: ProgramSpec = {
  vert: BATCH_VERT_SRC, frag: BATCH_HULL_FRAG_SRC, uniforms: BATCH_HULL_UNIFORMS, attributes: BATCH_FILL_ATTRIBUTES,
};
const BATCH_FILL_MATRICES_HULL_SPEC: ProgramSpec = {
  vert: BATCH_VERT_SRC, frag: BATCH_MATRICES_HULL_FRAG_SRC, uniforms: BATCH_HULL_UNIFORMS, attributes: BATCH_FILL_ATTRIBUTES,
};
export const PATTERN_FILL_SPEC: ProgramSpec = {
  vert: PATTERN_VERT_SRC, frag: PATTERN_FRAG_SRC, uniforms: PATTERN_FILL_UNIFORMS, attributes: PATTERN_FILL_ATTRIBUTES,
};

/** Built eagerly: nearly every frame draws with it, and `DrawBatch` binds its
 *  attributes at construction. */
export function createBatchFill(gl: WebGL2RenderingContext): ShaderProgram {
  const program = new ShaderProgram(gl, BATCH_VERT_SRC, BATCH_FRAG_SRC);
  program.lookupUniforms(BATCH_FILL_UNIFORMS);
  program.lookupAttributes(BATCH_FILL_ATTRIBUTES);
  return program;
}

/** The batch program's other builds, which a run picks by what it holds. */
export interface BatchVariants {
  /**
   * Whether a run may hold a hull clip: only where the default framebuffer
   * takes one sample a pixel, which is where the shader's decision is exact
   * (`batchHull.ts`).
   */
  readonly hulls: boolean;
  /** The build for a run under several color matrices, holding a hull, or
   *  holding glyphs that need area coverage, in any combination. A run with
   *  none of them draws with `createBatchFill`'s. */
  get(matrices: boolean, hulls: boolean, area?: boolean): ShaderProgram;
}

/** `BatchVariants` over this context, each build compiled the first time a
 *  run needs it. */
export class BatchVariantPrograms implements BatchVariants {
  readonly hulls: boolean;
  private readonly matrices: LazyProgram;
  private readonly hull: LazyProgram;
  private readonly matricesHull: LazyProgram;
  /** Indexed by `matrices + 2 * hulls`. */
  private readonly area: LazyProgram[];

  constructor(gl: WebGL2RenderingContext) {
    // The default framebuffer's, read while it is bound.
    this.hulls = gl.getParameter(gl.SAMPLES) === 0;
    this.matrices = new LazyProgram(gl, BATCH_FILL_MATRICES_SPEC);
    this.hull = new LazyProgram(gl, BATCH_FILL_HULL_SPEC);
    this.matricesHull = new LazyProgram(gl, BATCH_FILL_MATRICES_HULL_SPEC);
    this.area = [false, true].flatMap((hulls) => [false, true].map((matrices) => new LazyProgram(gl, {
      vert: BATCH_VERT_SRC,
      frag: batchAreaFragSrc(matrices, hulls),
      uniforms: hulls ? BATCH_HULL_UNIFORMS : BATCH_FILL_UNIFORMS,
      attributes: BATCH_FILL_ATTRIBUTES,
    })));
  }

  get(matrices: boolean, hulls: boolean, area = false): ShaderProgram {
    if (area) return this.area[Number(matrices) + 2 * Number(hulls)].get();
    if (!hulls) return this.matrices.get();
    return (matrices ? this.matricesHull : this.hull).get();
  }

  lazy(): LazyProgram[] {
    return [this.matrices, this.hull, this.matricesHull, ...this.area];
  }
}
