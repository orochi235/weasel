import { ShaderProgram } from './ShaderProgram';
import {
  VERT_SRC,
  FRAG_SRC,
  VCOLOR_VERT_SRC,
  VCOLOR_FRAG_SRC,
  PATH_FILL_UNIFORMS,
  PATH_FILL_ATTRIBUTES,
  PATH_FILL_VCOLOR_ATTRIBUTES,
} from './shaders/pathFill';
import {
  TEXT_VERT_SRC,
  TEXT_FRAG_SRC,
  TEXT_SDF_UNIFORMS,
  TEXT_SDF_ATTRIBUTES,
} from './shaders/textSdf';
import {
  IMAGE_VERT_SRC,
  IMAGE_FRAG_SRC,
  IMAGE_FILL_UNIFORMS,
  IMAGE_FILL_ATTRIBUTES,
} from './shaders/imageFill';
import {
  GRAD_VERT_SRC,
  GRAD_FRAG_SRC,
  GRAD_FILL_UNIFORMS,
  GRAD_FILL_ATTRIBUTES,
} from './shaders/gradFill';
import { GLMeshCache } from './GLMeshCache';
import { GLTextureCache } from './GLTextureCache';
import { GLImageCache } from './GLImageCache';
import { GradientRampCache } from './GradientRampCache';
import { GroupState } from './GroupState';
import type { DrawCommand } from './DrawCommand';
import { dispatch, type DrawContext } from './draw';
import { _markAllFontsNotUploaded } from './registerFont';
import {
  CUSTOM_VERT_SRC, CUSTOM_ATTRIBUTES, CUSTOM_KIT_UNIFORMS,
  QUAD_VERTICES, QUAD_INDICES,
} from './shaders/customPrelude';
import { getProgramSource, type ShaderProgramHandle } from './registerProgram';

function extractUniformNames(glsl: string): string[] {
  const re = /\buniform\s+\S+\s+(\w+)\s*;/g;
  const names: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(glsl)) !== null) names.push(m[1]);
  return names;
}

export interface WeaselRendererOptions {
  gl?: WebGL2RenderingContext;
  canvas?: HTMLCanvasElement;
  width: number;
  height: number;
  dpr: number;
}

export class WeaselRenderer {
  private readonly gl: WebGL2RenderingContext;
  private pathFill: ShaderProgram;
  private pathFillVColor: ShaderProgram;
  private textSdf: ShaderProgram;
  private imageFill: ShaderProgram;
  private gradFill: ShaderProgram;
  private meshCache: GLMeshCache;
  private textureCache: GLTextureCache;
  private imageCache: GLImageCache;
  private gradRampCache: GradientRampCache;
  private programRegistry = new Map<string, ShaderProgram>();
  private quadVbo: WebGLBuffer | null = null;
  private quadIbo: WebGLBuffer | null = null;
  /** Shared rect-fill geometry: 4 verts × 2 floats (dynamic), 6-index static IBO. */
  private rectVao: WebGLVertexArrayObject | null = null;
  private rectVbo: WebGLBuffer | null = null;
  private rectIbo: WebGLBuffer | null = null;
  private readonly groupState = new GroupState();
  private widthCss: number;
  private heightCss: number;
  private dpr: number;
  private canvas: HTMLCanvasElement | null = null;
  private contextLost = false;
  private boundOnLost = (e: Event) => this.onContextLost(e);
  private boundOnRestored = () => this.onContextRestored();

  constructor(opts: WeaselRendererOptions) {
    if (!opts.gl && !opts.canvas) {
      throw new Error('WeaselRenderer requires either gl or canvas');
    }
    const gl = opts.gl ?? opts.canvas!.getContext('webgl2', { stencil: true });
    if (!gl) throw new Error('WeaselRenderer: WebGL2 not available');
    this.gl = gl as WebGL2RenderingContext;

    this.widthCss = opts.width;
    this.heightCss = opts.height;
    this.dpr = opts.dpr;

    this.canvas = opts.canvas ?? null;
    if (this.canvas) {
      this.canvas.width = Math.round(opts.width * opts.dpr);
      this.canvas.height = Math.round(opts.height * opts.dpr);
      if (this.canvas.style) {
        this.canvas.style.width = `${opts.width}px`;
        this.canvas.style.height = `${opts.height}px`;
      }
      this.canvas.addEventListener('webglcontextlost', this.boundOnLost);
      this.canvas.addEventListener('webglcontextrestored', this.boundOnRestored);
    }

    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
    this.gl.disable(this.gl.DEPTH_TEST);
    this.gl.disable(this.gl.CULL_FACE);
    this.gl.clearColor(0, 0, 0, 0);
    this.applyViewport();

    this.pathFill = new ShaderProgram(this.gl, VERT_SRC, FRAG_SRC);
    this.pathFill.lookupUniforms(PATH_FILL_UNIFORMS);
    this.pathFill.lookupAttributes(PATH_FILL_ATTRIBUTES);

    this.pathFillVColor = new ShaderProgram(this.gl, VCOLOR_VERT_SRC, VCOLOR_FRAG_SRC);
    this.pathFillVColor.lookupUniforms(PATH_FILL_UNIFORMS);
    this.pathFillVColor.lookupAttributes(PATH_FILL_VCOLOR_ATTRIBUTES);

    this.textSdf = new ShaderProgram(this.gl, TEXT_VERT_SRC, TEXT_FRAG_SRC);
    this.textSdf.lookupUniforms(TEXT_SDF_UNIFORMS);
    this.textSdf.lookupAttributes(TEXT_SDF_ATTRIBUTES);

    this.imageFill = new ShaderProgram(this.gl, IMAGE_VERT_SRC, IMAGE_FRAG_SRC);
    this.imageFill.lookupUniforms(IMAGE_FILL_UNIFORMS);
    this.imageFill.lookupAttributes(IMAGE_FILL_ATTRIBUTES);

    this.gradFill = new ShaderProgram(this.gl, GRAD_VERT_SRC, GRAD_FRAG_SRC);
    this.gradFill.lookupUniforms(GRAD_FILL_UNIFORMS);
    this.gradFill.lookupAttributes(GRAD_FILL_ATTRIBUTES);

    const aPos = this.pathFill.attribute('a_position');
    if (aPos === undefined) throw new Error('WeaselRenderer: a_position not found in path-fill shader');
    this.meshCache = new GLMeshCache(this.gl, aPos);
    this.textureCache = new GLTextureCache(this.gl);
    this.imageCache = new GLImageCache(this.gl);
    this.gradRampCache = new GradientRampCache(this.gl);
    this.uploadQuadGeometry();
    this.uploadRectGeometry(aPos);
  }

  /** Allocate the shared rect VAO + dynamic VBO (4 verts × 2 floats) + static
   *  IBO (6 indices). drawRectFast bufferSubData's the 4 corner coords each
   *  draw, avoiding per-rect buffer allocation in animated demos. */
  private uploadRectGeometry(aPositionLoc: number): void {
    const gl = this.gl;
    this.rectVao = gl.createVertexArray();
    this.rectVbo = gl.createBuffer();
    this.rectIbo = gl.createBuffer();
    if (!this.rectVao || !this.rectVbo || !this.rectIbo) {
      throw new Error('WeaselRenderer: failed to create rect-fast geometry');
    }
    gl.bindVertexArray(this.rectVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectVbo);
    // Pre-allocate 8 floats (4 verts × 2 coords) of dynamic storage.
    gl.bufferData(gl.ARRAY_BUFFER, 8 * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(aPositionLoc);
    gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.rectIbo);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint32Array([0, 1, 2, 0, 2, 3]),
      gl.STATIC_DRAW,
    );
    gl.bindVertexArray(null);
  }

  private uploadQuadGeometry(): void {
    const gl = this.gl;
    this.quadVbo = gl.createBuffer();
    this.quadIbo = gl.createBuffer();
    if (!this.quadVbo || !this.quadIbo) {
      throw new Error('WeaselRenderer: failed to create quad geometry buffers');
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIbo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, QUAD_INDICES, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }

  /**
   * Compile a consumer-registered shader program against this renderer's GL context.
   *
   * Call once per renderer after the module-level `registerProgram()`.
   * Throws `ShaderCompileError` if compilation fails.
   *
   * In dev mode, calling again with the same handle replaces the compiled program.
   *
   * @experimental
   */
  registerProgram(handle: ShaderProgramHandle): void {
    const src = getProgramSource(handle.id);
    if (!src) {
      throw new Error(
        `WeaselRenderer.registerProgram: program "${handle.id}" not found in source registry. ` +
        `Call the module-level registerProgram() first.`,
      );
    }
    const vertSrc = src.vert === '' ? CUSTOM_VERT_SRC : src.vert;
    const fragSrc = src.frag;
    const program = new ShaderProgram(this.gl, vertSrc, fragSrc);
    program.lookupUniforms([...CUSTOM_KIT_UNIFORMS, ...extractUniformNames(fragSrc)]);
    program.lookupAttributes(CUSTOM_ATTRIBUTES);
    this.programRegistry.set(handle.id, program);
  }

  private applyViewport(): void {
    this.gl.viewport(0, 0, this.widthCss * this.dpr, this.heightCss * this.dpr);
  }

  isContextLost(): boolean {
    return this.contextLost;
  }

  private onContextLost(e: Event): void {
    e.preventDefault();
    this.contextLost = true;
  }

  private onContextRestored(): void {
    this.contextLost = false;
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
    this.gl.disable(this.gl.DEPTH_TEST);
    this.gl.disable(this.gl.CULL_FACE);
    this.gl.clearColor(0, 0, 0, 0);
    this.applyViewport();
    this.pathFill = new ShaderProgram(this.gl, VERT_SRC, FRAG_SRC);
    this.pathFill.lookupUniforms(PATH_FILL_UNIFORMS);
    this.pathFill.lookupAttributes(PATH_FILL_ATTRIBUTES);
    this.pathFillVColor = new ShaderProgram(this.gl, VCOLOR_VERT_SRC, VCOLOR_FRAG_SRC);
    this.pathFillVColor.lookupUniforms(PATH_FILL_UNIFORMS);
    this.pathFillVColor.lookupAttributes(PATH_FILL_VCOLOR_ATTRIBUTES);
    this.textSdf = new ShaderProgram(this.gl, TEXT_VERT_SRC, TEXT_FRAG_SRC);
    this.textSdf.lookupUniforms(TEXT_SDF_UNIFORMS);
    this.textSdf.lookupAttributes(TEXT_SDF_ATTRIBUTES);
    this.imageFill = new ShaderProgram(this.gl, IMAGE_VERT_SRC, IMAGE_FRAG_SRC);
    this.imageFill.lookupUniforms(IMAGE_FILL_UNIFORMS);
    this.imageFill.lookupAttributes(IMAGE_FILL_ATTRIBUTES);
    this.gradFill = new ShaderProgram(this.gl, GRAD_VERT_SRC, GRAD_FRAG_SRC);
    this.gradFill.lookupUniforms(GRAD_FILL_UNIFORMS);
    this.gradFill.lookupAttributes(GRAD_FILL_ATTRIBUTES);
    const aPos = this.pathFill.attribute('a_position');
    if (aPos === undefined) throw new Error('a_position missing after restore');
    this.meshCache = new GLMeshCache(this.gl, aPos);
    this.textureCache = new GLTextureCache(this.gl);
    this.imageCache = new GLImageCache(this.gl);
    this.gradRampCache = new GradientRampCache(this.gl);
    _markAllFontsNotUploaded();

    this.uploadQuadGeometry();
    this.uploadRectGeometry(aPos);
    for (const id of this.programRegistry.keys()) {
      const src = getProgramSource(id);
      if (!src) continue;
      const vertSrc = src.vert === '' ? CUSTOM_VERT_SRC : src.vert;
      try {
        const program = new ShaderProgram(this.gl, vertSrc, src.frag);
        program.lookupUniforms([...CUSTOM_KIT_UNIFORMS, ...extractUniformNames(src.frag)]);
        program.lookupAttributes(CUSTOM_ATTRIBUTES);
        this.programRegistry.set(id, program);
      } catch (e) {
        console.error(`weasel-gl: failed to recompile program "${id}" after context restore:`, e);
      }
    }
  }

  render(commands: DrawCommand[]): void {
    if (this.contextLost) return;
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    const ctx: DrawContext = {
      gl,
      pathFill: this.pathFill,
      pathFillVColor: this.pathFillVColor,
      textSdf: this.textSdf,
      imageFill: this.imageFill,
      gradFill: this.gradFill,
      meshCache: this.meshCache,
      textureCache: this.textureCache,
      imageCache: this.imageCache,
      gradRampCache: this.gradRampCache,
      programRegistry: this.programRegistry,
      quadVbo: this.quadVbo,
      quadIbo: this.quadIbo,
      rectVao: this.rectVao,
      rectVbo: this.rectVbo,
      state: this.groupState,
      widthCss: this.widthCss,
      heightCss: this.heightCss,
    };
    for (const cmd of commands) dispatch(ctx, cmd);
  }

  resize(dims: { width: number; height: number; dpr: number }): void {
    this.widthCss = dims.width;
    this.heightCss = dims.height;
    this.dpr = dims.dpr;
    if (this.canvas) {
      this.canvas.width = Math.round(dims.width * dims.dpr);
      this.canvas.height = Math.round(dims.height * dims.dpr);
      if (this.canvas.style) {
        this.canvas.style.width = `${dims.width}px`;
        this.canvas.style.height = `${dims.height}px`;
      }
    }
    this.applyViewport();
  }

  /** @internal */ _gl(): WebGL2RenderingContext { return this.gl; }
  /** @internal */ _pathFill(): ShaderProgram { return this.pathFill; }
  /** @internal */ _pathFillVColor(): ShaderProgram { return this.pathFillVColor; }
  /** @internal */ _textSdf(): ShaderProgram { return this.textSdf; }
  /** @internal */ _imageFill(): ShaderProgram { return this.imageFill; }
  /** @internal */ _gradFill(): ShaderProgram { return this.gradFill; }
  /** @internal */ _meshCache(): GLMeshCache { return this.meshCache; }
  /** @internal */ _textureCache(): GLTextureCache { return this.textureCache; }
  /** @internal */ _imageCache(): GLImageCache { return this.imageCache; }
  /** @internal */ _gradRampCache(): GradientRampCache { return this.gradRampCache; }
  /** @internal */ _groupState(): GroupState { return this.groupState; }
  /** @internal */ _widthCss(): number { return this.widthCss; }
  /** @internal */ _heightCss(): number { return this.heightCss; }
  /** @internal */ _dpr(): number { return this.dpr; }
}
