/**
 * A linked GL program, its uniform and attribute locations cached by name.
 * Throws `ShaderCompileError` on compile or link failure with the GL info log
 * embedded — never returns a half-initialized program.
 */
import { ShaderCompileError, POSITION_ATTRIBUTE_LOCATION, type ShaderStage } from '../../shaders/ShaderProgram';
import { ID_UNIFORM, withIdOutput } from '../../shaders/idOutput';
import type {
  GpuProgram, GpuProgramOptions, GpuTexture, GpuUniformArray, GpuUniformData, GpuUniformType,
} from '../types';
import { setUniformData } from './uniformUpload';

/** What a program needs of the device that made it. */
export interface GlProgramHost {
  readonly gl: WebGL2RenderingContext;
  /** Make `program` current, if it is not. */
  use(program: GlProgram): void;
}

interface GlArray extends GpuUniformArray {
  readonly location: WebGLUniformLocation;
}

export class GlProgram implements GpuProgram {
  readonly kind = 'program' as const;
  readonly handle: WebGLProgram;
  readonly writesIds: boolean;
  private readonly uniforms = new Map<string, WebGLUniformLocation>();
  private readonly arrays = new Map<string, GlArray>();
  private readonly attributes = new Map<string, number>();
  /** Each sampler's unit, by name, and an array's first. */
  private readonly samplerUnits = new Map<string, number>();
  /** What each unit this program samples holds, by unit. */
  readonly textures: (GpuTexture | null)[] = [];

  constructor(
    private readonly host: GlProgramHost,
    vertSrc: string,
    fragSrc: string,
    options: GpuProgramOptions = {},
  ) {
    const gl = host.gl;
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
    if (rewritten) this.lookupUniforms([ID_UNIFORM]);
  }

  private compile(type: number, source: string, stage: ShaderStage): WebGLShader {
    const gl = this.host.gl;
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
      const loc = this.host.gl.getUniformLocation(this.handle, name);
      if (loc !== null) this.uniforms.set(name, loc);
    }
  }

  /** Record each array's slot-0 location under its bare name. An array the
   *  driver optimized away has no location and is left out. */
  lookupUniformArrays(decls: ReadonlyMap<string, { type: string; size: number }>): void {
    for (const [name, { type, size }] of decls) {
      const base = `${name}[0]`;
      const location = this.uniforms.get(base) ?? this.host.gl.getUniformLocation(this.handle, base);
      if (location !== null) this.arrays.set(name, { type, size, location });
    }
  }

  lookupAttributes(names: readonly string[]): void {
    for (const name of names) {
      const loc = this.host.gl.getAttribLocation(this.handle, name);
      if (loc >= 0) this.attributes.set(name, loc);
    }
  }

  has(name: string): boolean {
    return this.uniforms.has(name);
  }

  array(name: string): GpuUniformArray | undefined {
    return this.arrays.get(name);
  }

  attribute(name: string): number | undefined {
    return this.attributes.get(name);
  }

  /** The location writes to `name` go to: the uniform's own, else an array's
   *  slot 0. */
  location(name: string): WebGLUniformLocation | undefined {
    return this.uniforms.get(name) ?? this.arrays.get(name)?.location;
  }

  private at(name: string): WebGLUniformLocation | undefined {
    const loc = this.location(name);
    if (loc !== undefined) this.host.use(this);
    return loc;
  }

  set1f(name: string, x: number): void {
    const loc = this.at(name);
    if (loc !== undefined) this.host.gl.uniform1f(loc, x);
  }

  set2f(name: string, x: number, y: number): void {
    const loc = this.at(name);
    if (loc !== undefined) this.host.gl.uniform2f(loc, x, y);
  }

  set4f(name: string, x: number, y: number, z: number, w: number): void {
    const loc = this.at(name);
    if (loc !== undefined) this.host.gl.uniform4f(loc, x, y, z, w);
  }

  set1i(name: string, x: number): void {
    const loc = this.at(name);
    if (loc !== undefined) this.host.gl.uniform1i(loc, x);
  }

  set(name: string, type: GpuUniformType, data: GpuUniformData, offset?: number, count?: number): void {
    const loc = this.at(name);
    if (loc !== undefined) setUniformData(this.host.gl, loc, type, data, offset, count);
  }

  /** Units are handed out in the order samplers are first set, an array's as
   *  one block, and each sampler uniform is written once, when its unit is. */
  setTexture(name: string, texture: GpuTexture | null, index = 0): void {
    let base = this.samplerUnits.get(name);
    if (base === undefined) {
      const loc = this.at(name);
      if (loc === undefined) return;
      base = this.textures.length;
      const size = this.arrays.get(name)?.size ?? 1;
      for (let i = 0; i < size; i++) this.textures.push(null);
      this.samplerUnits.set(name, base);
      const gl = this.host.gl;
      if (size === 1) gl.uniform1i(loc, base);
      else gl.uniform1iv(loc, Int32Array.from({ length: size }, (_, i) => base! + i));
    }
    this.textures[base + index] = texture;
  }
}

/** The GL program behind `program`, for a test matching recorded calls. */
export function glProgramHandle(program: GpuProgram): WebGLProgram {
  return (program as GlProgram).handle;
}

/** Where `program` writes uniform `name`, for a test matching recorded calls. */
export function glUniformLocation(program: GpuProgram, name: string): WebGLUniformLocation | undefined {
  return (program as GlProgram).location(name);
}
