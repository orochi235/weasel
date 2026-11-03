import { ShaderProgram } from './ShaderProgram';
import { CUSTOM_ATTRIBUTES, CUSTOM_KIT_UNIFORMS, CUSTOM_VERT_SRC } from './customPrelude';
import { extractUniformArrays, extractUniformNames } from './extractUniformNames';
import { getProgramSource, type ProgramSource } from './registerProgram';

/** Every uniform a custom program may be written through. Both stages, not
 *  just the fragment one: a name never looked up is written through `null`,
 *  which GL accepts silently, so the uniform keeps its zero default. */
function customUniformNames(vertSrc: string, fragSrc: string): string[] {
  return [...CUSTOM_KIT_UNIFORMS, ...extractUniformNames(vertSrc), ...extractUniformNames(fragSrc)];
}

/** Compile a registered program's source against `gl`, with every uniform
 *  location and array base it may be written through. */
function compileCustomProgram(gl: WebGL2RenderingContext, src: ProgramSource): ShaderProgram {
  const vertSrc = src.vert === '' ? CUSTOM_VERT_SRC : src.vert;
  const program = new ShaderProgram(gl, vertSrc, src.frag);
  program.lookupUniforms(customUniformNames(vertSrc, src.frag));
  program.lookupUniformArrays(new Map([...extractUniformArrays(vertSrc), ...extractUniformArrays(src.frag)]));
  program.lookupAttributes(CUSTOM_ATTRIBUTES);
  return program;
}

/** One renderer's compiled copies of the module-level registered programs. */
export class CustomPrograms {
  readonly registry = new Map<string, ShaderProgram>();
  /** The source each compiled program was built from — or, after a failed
   *  recompile, the source that failed, so it is not retried every frame. */
  private readonly sources = new Map<string, ProgramSource>();
  /** Advanced when a program is compiled again over one already drawn with,
   *  which leaves every retained surface drawn by the old one stale. */
  epoch = 0;

  constructor(private gl: WebGL2RenderingContext) {}

  /** Compile `id`'s registered source. Throws when there is none, or on a
   *  compile failure. */
  register(id: string): void {
    const src = getProgramSource(id);
    if (!src) {
      throw new Error(`WeaselRenderer.registerProgram: program "${id}" not found in source registry. `
        + 'Call the module-level registerProgram() first.');
    }
    this.install(id, src, compileCustomProgram(this.gl, src));
  }

  private install(id: string, src: ProgramSource, program: ShaderProgram): void {
    const previous = this.registry.get(id);
    if (previous) {
      this.gl.deleteProgram(previous.handle);
      this.epoch++;
    }
    this.registry.set(id, program);
    this.sources.set(id, src);
  }

  /** Recompile every program whose module-level source was re-registered
   *  since it was compiled. A source that fails keeps the old program drawing. */
  refresh(): void {
    for (const [id, compiled] of this.sources) {
      const src = getProgramSource(id);
      if (!src || src === compiled) continue;
      if (src.vert === compiled.vert && src.frag === compiled.frag) {
        this.sources.set(id, src);
        continue;
      }
      try {
        this.install(id, src, compileCustomProgram(this.gl, src));
      } catch (e) {
        this.sources.set(id, src);
        console.error(`weasel: failed to recompile re-registered program "${id}"; still drawing the previous one:`, e);
      }
    }
  }

  /**
   * The compiled program for `id`, compiling it on first use. Unlike
   * `register` this neither throws on a missing source nor on a compile
   * failure: a paint kind asking for a program it never registered must
   * decline the paint, not take down the frame.
   */
  ensure(id: string): ShaderProgram | null {
    const existing = this.registry.get(id);
    if (existing) return existing;
    if (!getProgramSource(id)) return null;
    try {
      this.register(id);
    } catch (e) {
      console.error(`weasel: failed to compile paint program "${id}":`, e);
      return null;
    }
    return this.registry.get(id) ?? null;
  }

  /** Compile every program again on a restored context, `gl`. */
  restore(gl: WebGL2RenderingContext): void {
    this.gl = gl;
    for (const id of this.registry.keys()) {
      const src = getProgramSource(id);
      if (!src) continue;
      try {
        this.registry.set(id, compileCustomProgram(gl, src));
        this.sources.set(id, src);
      } catch (e) {
        console.error(`weasel: failed to recompile program "${id}" after context restore:`, e);
      }
    }
  }

  /** Delete every compiled program. */
  dispose(): void {
    for (const prog of this.registry.values()) this.gl.deleteProgram(prog.handle);
    this.registry.clear();
    this.sources.clear();
  }
}
