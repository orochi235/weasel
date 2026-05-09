import { ShaderProgram } from './ShaderProgram';
import {
  VERT_SRC,
  FRAG_SRC,
  PATH_FILL_UNIFORMS,
  PATH_FILL_ATTRIBUTES,
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
  private textSdf: ShaderProgram;
  private imageFill: ShaderProgram;
  private gradFill: ShaderProgram;
  private meshCache: GLMeshCache;
  private textureCache: GLTextureCache;
  private imageCache: GLImageCache;
  private gradRampCache: GradientRampCache;
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
      this.canvas.width = opts.width * opts.dpr;
      this.canvas.height = opts.height * opts.dpr;
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
  }

  render(commands: DrawCommand[]): void {
    if (this.contextLost) return;
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    const ctx: DrawContext = {
      gl,
      pathFill: this.pathFill,
      textSdf: this.textSdf,
      imageFill: this.imageFill,
      gradFill: this.gradFill,
      meshCache: this.meshCache,
      textureCache: this.textureCache,
      imageCache: this.imageCache,
      gradRampCache: this.gradRampCache,
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
      this.canvas.width = dims.width * dims.dpr;
      this.canvas.height = dims.height * dims.dpr;
    }
    this.applyViewport();
  }

  /** @internal */ _gl(): WebGL2RenderingContext { return this.gl; }
  /** @internal */ _pathFill(): ShaderProgram { return this.pathFill; }
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
