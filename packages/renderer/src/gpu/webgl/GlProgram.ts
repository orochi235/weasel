/**
 * A linked GL program, its uniform and attribute locations cached by name. Where the context offers
 * `KHR_parallel_shader_compile` it compiles and links in the background, and the first read of a
 * location waits for it (`settle`); elsewhere the constructor waits. Either throws `ShaderCompileError`
 * on a compile or link failure, with the GL info log embedded.
 */
import { ShaderCompileError, POSITION_ATTRIBUTE_LOCATION } from '../../shaders/ShaderProgram';
import { ID_UNIFORM, withIdOutput } from '../../shaders/idOutput';
import type {
  GpuProgram, GpuProgramOptions, GpuTexture, GpuUniformArray, GpuUniformData, GpuUniformType,
} from '../types';
import { setUniformData } from './uniformUpload';
import { checkSamplerIndex } from '../samplerIndex';

/** What a program needs of the device that made it. */
export interface GlProgramHost {
  readonly gl: WebGL2RenderingContext;
  /** `KHR_parallel_shader_compile`'s `COMPLETION_STATUS_KHR`, where the context offers it: a program then
   *  compiles and links in the background, and waits for that only when first used. */
  readonly completionStatus: number | null;
  /** Make `program` current, if it is not. */
  use(program: GlProgram): void;
}

interface GlArray extends GpuUniformArray {
  readonly location: WebGLUniformLocation;
}

type Lookup =
  | { readonly kind: 'uniforms'; readonly names: readonly string[] }
  | { readonly kind: 'arrays'; readonly decls: ReadonlyMap<string, { type: string; size: number }> }
  | { readonly kind: 'attributes'; readonly names: readonly string[] };

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
  /** The stages, held until the link is known to have succeeded, for their logs if it did not. */
  private stages: readonly [WebGLShader, WebGLShader] | null;
  /** Lookups asked for before the link finished, run when it has. */
  private pending: Lookup[] | null = [];
  private failure: ShaderCompileError | null = null;

  constructor(
    private readonly host: GlProgramHost,
    vertSrc: string,
    fragSrc: string,
    options: GpuProgramOptions = {},
  ) {
    const gl = host.gl;
    const rewritten = options.ids === false ? null : withIdOutput(vertSrc, fragSrc);
    if (rewritten) ({ vert: vertSrc, frag: fragSrc } = rewritten);
    const vs = this.compile(gl.VERTEX_SHADER, vertSrc);
    const fs = this.compile(gl.FRAGMENT_SHADER, fragSrc);
    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      throw new Error('createProgram returned null');
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, POSITION_ATTRIBUTE_LOCATION, 'a_position');
    for (const [name, location] of Object.entries(options.attributes ?? {})) this.attributes.set(name, location);
    gl.linkProgram(program);
    this.handle = program;
    this.stages = [vs, fs];
    this.writesIds = rewritten !== null;
    if (rewritten) this.lookupUniforms([ID_UNIFORM]);
    // Unflushed, the compile waits in the client until the next call that syncs, usually the first draw.
    if (host.completionStatus === null) this.settle();
    else gl.flush();
  }

  /** Free the program, and its stages where it was deleted before its link was waited on. */
  delete(): void {
    const gl = this.host.gl;
    if (this.stages) {
      gl.deleteShader(this.stages[0]);
      gl.deleteShader(this.stages[1]);
      this.stages = null;
      this.pending = null;
    }
    gl.deleteProgram(this.handle);
  }

  private compile(type: number, source: string): WebGLShader {
    const gl = this.host.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error('createShader returned null');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }

  /** Whether the program has finished compiling and linking, asked without waiting for it. */
  ready(): boolean {
    if (this.pending === null) return true;
    const status = this.host.completionStatus;
    // A lost context, or a restored one the extension is not enabled on again, answers null: `settle` knows both.
    if (status !== null && this.host.gl.getProgramParameter(this.handle, status) === false) return false;
    this.settle();
    return true;
  }

  /**
   * Wait for the link, throw `ShaderCompileError` if it failed, and run the lookups asked for meanwhile.
   * Every read of a location comes through here, so a program used before it is ready waits for it then.
   */
  settle(): void {
    if (this.failure) throw this.failure;
    if (this.pending === null) return;
    const gl = this.host.gl;
    const [vs, fs] = this.stages!;
    this.stages = null;
    const lookups = this.pending;
    this.pending = null;
    const failed = ([[vs, 'vertex'], [fs, 'fragment']] as const).find(([sh]) => !gl.getShaderParameter(sh, gl.COMPILE_STATUS));
    if (failed || !gl.getProgramParameter(this.handle, gl.LINK_STATUS)) {
      // A lost context answers every status as failed; the program draws nothing, and a restore builds a new one.
      if (gl.isContextLost()) return;
      this.failure = failed
        ? new ShaderCompileError(failed[1], gl.getShaderInfoLog(failed[0]) ?? '')
        : new ShaderCompileError('link', gl.getProgramInfoLog(this.handle) ?? '');
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteProgram(this.handle);
      throw this.failure;
    }
    // Flagged for deletion, attached shaders live exactly as long as the program, so `deleteProgram` frees them too.
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    for (const lookup of lookups) {
      if (lookup.kind === 'uniforms') this.lookupUniforms(lookup.names);
      else if (lookup.kind === 'arrays') this.lookupUniformArrays(lookup.decls);
      else this.lookupAttributes(lookup.names);
    }
  }

  lookupUniforms(names: readonly string[]): void {
    if (this.pending) { this.pending.push({ kind: 'uniforms', names }); return; }
    for (const name of names) {
      const loc = this.host.gl.getUniformLocation(this.handle, name);
      if (loc !== null) this.uniforms.set(name, loc);
    }
  }

  /** Record each array's slot-0 location under its bare name. An array the
   *  driver optimized away has no location and is left out. */
  lookupUniformArrays(decls: ReadonlyMap<string, { type: string; size: number }>): void {
    if (this.pending) { this.pending.push({ kind: 'arrays', decls }); return; }
    for (const [name, { type, size }] of decls) {
      const base = `${name}[0]`;
      const location = this.uniforms.get(base) ?? this.host.gl.getUniformLocation(this.handle, base);
      if (location !== null) this.arrays.set(name, { type, size, location });
    }
  }

  lookupAttributes(names: readonly string[]): void {
    const unbound = names.filter((name) => !this.attributes.has(name));
    if (unbound.length === 0) return;
    if (this.pending) { this.pending.push({ kind: 'attributes', names: unbound }); return; }
    for (const name of unbound) {
      const loc = this.host.gl.getAttribLocation(this.handle, name);
      if (loc >= 0) this.attributes.set(name, loc);
    }
  }

  has(name: string): boolean {
    this.settle();
    return this.uniforms.has(name);
  }

  array(name: string): GpuUniformArray | undefined {
    this.settle();
    return this.arrays.get(name);
  }

  /** A location bound before the link answers at once; any other waits for the link. */
  attribute(name: string): number | undefined {
    if (!this.attributes.has(name)) this.settle();
    return this.attributes.get(name);
  }

  /** The location writes to `name` go to: the uniform's own, else an array's
   *  slot 0. */
  location(name: string): WebGLUniformLocation | undefined {
    this.settle();
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
    this.settle();
    let base = this.samplerUnits.get(name);
    const size = this.arrays.get(name)?.size ?? 1;
    if (base === undefined) {
      const loc = this.at(name);
      if (loc === undefined) return;
      checkSamplerIndex(name, index, size);
      base = this.textures.length;
      for (let i = 0; i < size; i++) this.textures.push(null);
      this.samplerUnits.set(name, base);
      const gl = this.host.gl;
      if (size === 1) gl.uniform1i(loc, base);
      else gl.uniform1iv(loc, Int32Array.from({ length: size }, (_, i) => base! + i));
    } else {
      checkSamplerIndex(name, index, size);
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
