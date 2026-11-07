/**
 * What the WebGL backend believes the context holds, so a draw sends only the
 * state that differs from the last. `undefined` is unknown: `reset` forgets it
 * all at the start of a frame, because another user of a shared context may
 * have changed anything between frames.
 */
import type { BlendFactor, BlendFactors } from '../../effects/compositeOp';
import type { GpuRect, GpuStencilState } from '../types';

type DrawBuffers = 'both' | 'color' | 'ids';

export class GlCache {
  program: WebGLProgram | null | undefined;
  private vao: WebGLVertexArrayObject | null | undefined;
  framebuffer: WebGLFramebuffer | null | undefined;
  private blendOn: boolean | undefined;
  private blendSrc: BlendFactor | undefined;
  private blendDst: BlendFactor | undefined;
  private colorMask: boolean | undefined;
  private stencilOn: boolean | undefined;
  private stencilCompare: string | undefined;
  private stencilRef: number | undefined;
  private stencilRead: number | undefined;
  private stencilWrite: number | undefined;
  private stencilPass: string | undefined;
  private viewport: GpuRect | undefined;
  private scissorOn: boolean | undefined;
  private scissor: GpuRect | undefined;
  private activeUnit: number | undefined;
  private readonly units: (WebGLTexture | null | undefined)[] = [];
  /** Each id target's draw buffers. GL keeps them per framebuffer, so they
   *  survive a frame; only a restored context loses them. */
  private readonly drawBuffers = new WeakMap<WebGLFramebuffer, DrawBuffers>();

  constructor(private readonly gl: WebGL2RenderingContext) {}

  reset(): void {
    this.program = undefined;
    this.vao = undefined;
    this.framebuffer = undefined;
    this.blendOn = this.blendSrc = this.blendDst = undefined;
    this.colorMask = undefined;
    this.stencilOn = this.stencilCompare = this.stencilRef = this.stencilRead = undefined;
    this.stencilWrite = this.stencilPass = undefined;
    this.viewport = this.scissor = this.scissorOn = undefined;
    this.activeUnit = undefined;
    this.units.length = 0;
  }

  /** What the device's frame-start state has just set. */
  assume(state: { blend: BlendFactors; colorMask: boolean; vao: null }): void {
    this.blendOn = true;
    this.blendSrc = state.blend.source;
    this.blendDst = state.blend.destination;
    this.colorMask = state.colorMask;
    this.vao = state.vao;
  }

  useProgram(program: WebGLProgram): void {
    if (this.program === program) return;
    this.gl.useProgram(program);
    this.program = program;
  }

  forgetProgram(program: WebGLProgram): void {
    if (this.program === program) this.program = undefined;
  }

  bindVertexArray(vao: WebGLVertexArrayObject | null): void {
    if (this.vao === vao) return;
    this.gl.bindVertexArray(vao);
    this.vao = vao;
  }

  forgetVertexArray(vao: WebGLVertexArrayObject): void {
    if (this.vao === vao) this.vao = undefined;
  }

  bindFramebuffer(fbo: WebGLFramebuffer | null): void {
    if (this.framebuffer === fbo) return;
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fbo);
    this.framebuffer = fbo;
  }

  setBlend(blend: BlendFactors | null): void {
    const gl = this.gl;
    if (blend === null) {
      if (this.blendOn !== false) gl.disable(gl.BLEND);
      this.blendOn = false;
      return;
    }
    if (this.blendOn !== true) gl.enable(gl.BLEND);
    this.blendOn = true;
    if (this.blendSrc !== blend.source || this.blendDst !== blend.destination) {
      gl.blendFunc(glFactor(gl, blend.source), glFactor(gl, blend.destination));
      this.blendSrc = blend.source;
      this.blendDst = blend.destination;
    }
  }

  setColorMask(on: boolean): void {
    if (this.colorMask === on) return;
    this.gl.colorMask(on, on, on, on);
    this.colorMask = on;
  }

  /** Which attachments of an id target are drawn. */
  setDrawBuffers(fbo: WebGLFramebuffer, want: DrawBuffers): void {
    if (this.drawBuffers.get(fbo) === want) return;
    const gl = this.gl;
    const color = want === 'ids' ? gl.NONE : gl.COLOR_ATTACHMENT0;
    const ids = want === 'color' ? gl.NONE : gl.COLOR_ATTACHMENT1;
    gl.drawBuffers([color, ids]);
    this.drawBuffers.set(fbo, want);
  }

  /** Record what a framebuffer was made with. */
  madeDrawBuffers(fbo: WebGLFramebuffer, have: DrawBuffers): void {
    this.drawBuffers.set(fbo, have);
  }

  setStencil(stencil: GpuStencilState | null): void {
    const gl = this.gl;
    if (stencil === null) {
      if (this.stencilOn !== false) gl.disable(gl.STENCIL_TEST);
      this.stencilOn = false;
      return;
    }
    if (this.stencilOn !== true) gl.enable(gl.STENCIL_TEST);
    this.stencilOn = true;
    const { compare, ref, readMask, writeMask, pass } = stencil;
    if (this.stencilCompare !== compare || this.stencilRef !== ref || this.stencilRead !== readMask) {
      gl.stencilFunc(compare === 'always' ? gl.ALWAYS : gl.EQUAL, ref, readMask);
      this.stencilCompare = compare;
      this.stencilRef = ref;
      this.stencilRead = readMask;
    }
    if (this.stencilPass !== pass) {
      gl.stencilOp(gl.KEEP, gl.KEEP, glStencilOp(gl, pass));
      this.stencilPass = pass;
    }
    this.setStencilMask(writeMask);
  }

  setStencilMask(mask: number): void {
    if (this.stencilWrite === mask) return;
    this.gl.stencilMask(mask);
    this.stencilWrite = mask;
  }

  setViewport(rect: GpuRect): void {
    const v = this.viewport;
    if (v && v.x === rect.x && v.y === rect.y && v.width === rect.width && v.height === rect.height) return;
    this.gl.viewport(rect.x, rect.y, rect.width, rect.height);
    this.viewport = { ...rect };
  }

  setScissor(rect: GpuRect | null): void {
    const gl = this.gl;
    if (rect === null) {
      if (this.scissorOn !== false) gl.disable(gl.SCISSOR_TEST);
      this.scissorOn = false;
      return;
    }
    const s = this.scissor;
    if (!(s && s.x === rect.x && s.y === rect.y && s.width === rect.width && s.height === rect.height)) {
      gl.scissor(rect.x, rect.y, rect.width, rect.height);
      this.scissor = { ...rect };
    }
    if (this.scissorOn !== true) gl.enable(gl.SCISSOR_TEST);
    this.scissorOn = true;
  }

  /** The scissor as set, for a caller that has to put it back. */
  scissorRect(): GpuRect | null | undefined {
    if (this.scissorOn === undefined) return undefined;
    return this.scissorOn ? this.scissor ?? null : null;
  }

  /** Forget the scissor test, after a caller toggled it directly. */
  forgetScissor(): void {
    this.scissorOn = undefined;
  }

  /** Bind `textures` to units 0.., each only where the unit holds another. */
  bindTextures(textures: readonly ({ readonly handle: WebGLTexture } | null)[]): void {
    const gl = this.gl;
    for (let unit = 0; unit < textures.length; unit++) {
      const tex = textures[unit]?.handle ?? null;
      if (this.units[unit] === tex) continue;
      this.activate(unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      this.units[unit] = tex;
    }
  }

  /** Run `fn` with `tex` bound to the active unit, and leave that unit empty. */
  withTexture(tex: WebGLTexture, fn: () => void): void {
    const gl = this.gl;
    if (this.activeUnit === undefined) this.activate(0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    fn();
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.units[this.activeUnit!] = null;
  }

  /** Empty every unit holding `tex`: a texture a pass draws into must not be
   *  sampled by it. */
  unbindTexture(tex: WebGLTexture): void {
    for (let unit = 0; unit < this.units.length; unit++) {
      if (this.units[unit] !== tex) continue;
      this.activate(unit);
      this.gl.bindTexture(this.gl.TEXTURE_2D, null);
      this.units[unit] = null;
    }
  }

  forgetTexture(tex: WebGLTexture): void {
    for (let unit = 0; unit < this.units.length; unit++) if (this.units[unit] === tex) this.units[unit] = undefined;
  }

  private activate(unit: number): void {
    if (this.activeUnit === unit) return;
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.activeUnit = unit;
  }
}

function glFactor(gl: WebGL2RenderingContext, factor: BlendFactor): number {
  switch (factor) {
    case 'zero': return gl.ZERO;
    case 'one': return gl.ONE;
    case 'source-alpha': return gl.SRC_ALPHA;
    case 'one-minus-source-alpha': return gl.ONE_MINUS_SRC_ALPHA;
    case 'destination-alpha': return gl.DST_ALPHA;
    case 'one-minus-destination-alpha': return gl.ONE_MINUS_DST_ALPHA;
  }
}

function glStencilOp(gl: WebGL2RenderingContext, op: GpuStencilState['pass']): number {
  switch (op) {
    case 'keep': return gl.KEEP;
    case 'replace': return gl.REPLACE;
    case 'invert': return gl.INVERT;
    case 'zero': return gl.ZERO;
  }
}
