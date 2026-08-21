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

export class ShaderProgram {
  readonly handle: WebGLProgram;
  private readonly uniforms = new Map<string, WebGLUniformLocation>();
  private readonly attributes = new Map<string, number>();

  constructor(
    private readonly gl: WebGL2RenderingContext,
    vertSrc: string,
    fragSrc: string,
  ) {
    const vs = this.compile(gl.VERTEX_SHADER, vertSrc, 'vertex');
    const fs = this.compile(gl.FRAGMENT_SHADER, fragSrc, 'fragment');
    const program = gl.createProgram();
    if (!program) throw new Error('createProgram returned null');
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program) ?? '';
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

  lookupAttributes(names: readonly string[]): void {
    for (const name of names) {
      const loc = this.gl.getAttribLocation(this.handle, name);
      if (loc >= 0) this.attributes.set(name, loc);
    }
  }

  uniform(name: string): WebGLUniformLocation | undefined {
    return this.uniforms.get(name);
  }

  attribute(name: string): number | undefined {
    return this.attributes.get(name);
  }
}
