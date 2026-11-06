/**
 * Minimal compile/link/lookup wrapper for a GL program. Throws
 * `ShaderCompileError` on compile or link failure with the GL info log
 * embedded in the error message — never returns a half-initialized program.
 *
 * Designed so test code can stub `getShaderParameter` / `getProgramParameter`
 * via the recorder Proxy without further special-casing.
 */

import { bindIdAttribute, withIdOutput } from './idOutput';

/** The step of building a program that a `ShaderCompileError` came from. */
export type ShaderStage = 'vertex' | 'fragment' | 'link';

/** Thrown when a shader fails to compile or link, carrying which stage failed
 *  and the driver's log. */
export class ShaderCompileError extends Error {
  constructor(public readonly stage: ShaderStage, public readonly log: string) {
    super(`shader ${stage} failure: ${log}`);
    this.name = 'ShaderCompileError';
  }
}

/** An array uniform a program can be written as a whole: its element type as
 *  declared, its declared length, and the location of slot 0. */
export interface UniformArray {
  readonly type: string;
  readonly size: number;
  readonly location: WebGLUniformLocation;
}

/** Where every program links `a_position`. A mesh VAO is built once and drawn
 *  with whichever fill program its paint picks, so the location cannot be
 *  left to each program's linker. */
export const POSITION_ATTRIBUTE_LOCATION = 0;

/** Programs whose sources `withIdOutput` could not rewrite, which write
 *  nothing at location 1. An id frame switches that attachment off for them. */
export const PROGRAMS_WITHOUT_IDS: WeakSet<WebGLProgram> = new WeakSet();

/** Programs built with `ids: false`, which write location 1 themselves under
 *  draw buffers their caller sets. An id frame leaves those buffers alone. */
export const PROGRAMS_WRITING_OWN_IDS: WeakSet<WebGLProgram> = new WeakSet();

/** How a program is built beyond its sources. */
export interface ShaderProgramOptions {
  /** Add the id output (`shaders/idOutput.ts`). Default `true`; `false` for a
   *  program that writes location 1 itself. */
  ids?: boolean;
}

/** A linked GL program with its uniform and attribute locations cached by name. */
export class ShaderProgram {
  readonly handle: WebGLProgram;
  /** Whether the program writes the id output an id frame reads. */
  readonly writesIds: boolean;
  private readonly uniforms = new Map<string, WebGLUniformLocation>();
  private readonly arrays = new Map<string, UniformArray>();
  private readonly attributes = new Map<string, number>();

  constructor(
    private readonly gl: WebGL2RenderingContext,
    vertSrc: string,
    fragSrc: string,
    options: ShaderProgramOptions = {},
  ) {
    const rewritten = options.ids === false ? null : withIdOutput(vertSrc, fragSrc);
    if (rewritten) ({ vert: vertSrc, frag: fragSrc } = rewritten);
    const vs = this.compile(gl.VERTEX_SHADER, vertSrc, 'vertex');
    let fs: WebGLShader;
    try {
      fs = this.compile(gl.FRAGMENT_SHADER, fragSrc, 'fragment');
    } catch (e) {
      gl.deleteShader(vs);
      throw e;
    }
    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      throw new Error('createProgram returned null');
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, POSITION_ATTRIBUTE_LOCATION, 'a_position');
    if (rewritten) bindIdAttribute(gl, program);
    gl.linkProgram(program);
    // Flagged for deletion, attached shaders live exactly as long as the
    // program, so `deleteProgram` frees them too.
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program) ?? '';
      gl.deleteProgram(program);
      throw new ShaderCompileError('link', log);
    }
    this.handle = program;
    this.writesIds = rewritten !== null;
    if (options.ids === false) PROGRAMS_WRITING_OWN_IDS.add(program);
    else if (!rewritten) PROGRAMS_WITHOUT_IDS.add(program);
  }

  private compile(type: number, source: string, stage: ShaderStage): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error('createShader returned null');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) ?? '';
      gl.deleteShader(shader);
      throw new ShaderCompileError(stage, log);
    }
    return shader;
  }

  lookupUniforms(names: readonly string[]): void {
    for (const name of names) {
      const loc = this.gl.getUniformLocation(this.handle, name);
      if (loc !== null) this.uniforms.set(name, loc);
    }
  }

  /** Record each array's slot-0 location under its bare name. An array the
   *  driver optimized away has no location and is left out. */
  lookupUniformArrays(decls: ReadonlyMap<string, { type: string; size: number }>): void {
    for (const [name, { type, size }] of decls) {
      const base = `${name}[0]`;
      const location = this.uniforms.get(base) ?? this.gl.getUniformLocation(this.handle, base);
      if (location !== null) this.arrays.set(name, { type, size, location });
    }
  }

  lookupAttributes(names: readonly string[]): void {
    for (const name of names) {
      const loc = this.gl.getAttribLocation(this.handle, name);
      if (loc >= 0) this.attributes.set(name, loc);
    }
  }

  uniform(name: string): WebGLUniformLocation | undefined {
    return this.uniforms.get(name);
  }

  uniformArray(name: string): UniformArray | undefined {
    return this.arrays.get(name);
  }

  attribute(name: string): number | undefined {
    return this.attributes.get(name);
  }
}
