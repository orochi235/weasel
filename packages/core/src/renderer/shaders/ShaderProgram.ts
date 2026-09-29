/**
 * Minimal compile/link/lookup wrapper for a GL program. Throws
 * `ShaderCompileError` on compile or link failure with the GL info log
 * embedded in the error message — never returns a half-initialized program.
 *
 * Designed so test code can stub `getShaderParameter` / `getProgramParameter`
 * via the recorder Proxy without further special-casing.
 */

export type Stage = 'vertex' | 'fragment' | 'link';

/** Thrown when a shader fails to compile or link, carrying which stage failed
 *  and the driver's log. */
export class ShaderCompileError extends Error {
  constructor(public readonly stage: Stage, public readonly log: string) {
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

/** A linked GL program with its uniform and attribute locations cached by name. */
export class ShaderProgram {
  readonly handle: WebGLProgram;
  private readonly uniforms = new Map<string, WebGLUniformLocation>();
  private readonly arrays = new Map<string, UniformArray>();
  private readonly attributes = new Map<string, number>();

  constructor(
    private readonly gl: WebGL2RenderingContext,
    vertSrc: string,
    fragSrc: string,
  ) {
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
  }

  private compile(type: number, source: string, stage: Stage): WebGLShader {
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
