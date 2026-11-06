import type { GpuDevice } from '../gpu/types';
import type { ShaderProgram } from './ShaderProgram';
import { CUSTOM_ATTRIBUTES, CUSTOM_KIT_UNIFORMS, CUSTOM_VERT_SRC } from './customPrelude';
import { extractUniformArrays, extractUniformNames } from './extractUniformNames';
import { getProgramSource, sameProgramSource, type ProgramSource } from './registerProgram';

/** Every uniform a custom program may be written through. Both stages, not
 *  just the fragment one: a name never looked up is written through `null`,
 *  which GL accepts silently, so the uniform keeps its zero default. */
function customUniformNames(vertSrc: string, fragSrc: string): string[] {
  return [...CUSTOM_KIT_UNIFORMS, ...extractUniformNames(vertSrc), ...extractUniformNames(fragSrc)];
}

/** Compile a registered program's source on `gpu`, with every uniform
 *  location and array base it may be written through. */
function compileCustomProgram(gpu: GpuDevice, id: string, src: ProgramSource): ShaderProgram {
  if (!src.glsl) throw new NoGlslError(id);
  const { frag } = src.glsl;
  const vertSrc = src.glsl.vert ?? CUSTOM_VERT_SRC;
  const program = gpu.createProgram({ glsl: { vert: vertSrc, frag } });
  program.lookupUniforms(customUniformNames(vertSrc, frag));
  program.lookupUniformArrays(new Map([...extractUniformArrays(vertSrc), ...extractUniformArrays(frag)]));
  program.lookupAttributes(CUSTOM_ATTRIBUTES);
  return program;
}

/** Thrown for a program registered with no GLSL source, which WebGL cannot draw. */
class NoGlslError extends Error {
  constructor(id: string) {
    super(`weasel: program "${id}" has no GLSL source, so the WebGL renderer cannot draw it; `
      + 'register it with `glsl` as well as `wgsl`.');
  }
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
  /** The source `ensure` last failed to compile for each id, so that source
   *  is reported once and not compiled again every frame. */
  private readonly declined = new Map<string, ProgramSource>();

  constructor(private readonly gpu: GpuDevice) {}

  /** Compile `id`'s registered source. Throws when there is none, or on a
   *  compile failure. */
  register(id: string): void {
    const src = getProgramSource(id);
    if (!src) {
      throw new Error(`WeaselRenderer.registerProgram: program "${id}" not found in source registry. `
        + 'Call the module-level registerProgram() first.');
    }
    this.install(id, src, compileCustomProgram(this.gpu, id, src));
  }

  private install(id: string, src: ProgramSource, program: ShaderProgram): void {
    const previous = this.registry.get(id);
    if (previous) {
      this.gpu.deleteProgram(previous);
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
      if (sameProgramSource(src, compiled)) {
        this.sources.set(id, src);
        continue;
      }
      try {
        this.install(id, src, compileCustomProgram(this.gpu, id, src));
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
    const src = getProgramSource(id);
    if (!src || this.declined.get(id) === src) return null;
    try {
      this.register(id);
    } catch (e) {
      this.declined.set(id, src);
      if (e instanceof NoGlslError) console.error(e.message);
      else console.error(`weasel: failed to compile program "${id}":`, e);
      return null;
    }
    return this.registry.get(id) ?? null;
  }

  /** Compile every program again on a restored context. */
  restore(): void {
    for (const id of this.registry.keys()) {
      const src = getProgramSource(id);
      if (!src) continue;
      try {
        this.registry.set(id, compileCustomProgram(this.gpu, id, src));
        this.sources.set(id, src);
      } catch (e) {
        console.error(`weasel: failed to recompile program "${id}" after context restore:`, e);
      }
    }
  }

  /** Delete every compiled program. */
  dispose(): void {
    for (const prog of this.registry.values()) this.gpu.deleteProgram(prog);
    this.registry.clear();
    this.sources.clear();
    this.declined.clear();
  }
}
