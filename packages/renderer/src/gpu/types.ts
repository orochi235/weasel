/**
 * The GPU layer the renderer's draw code is written against, once, for every
 * backend: draw-time state rather than a state machine, explicit passes, and
 * resources as opaque handles. `gpu/webgl/` implements it over WebGL2.
 *
 * Rects (viewport, scissor, read and resolve rects) count target pixels from
 * the bottom-left corner, as GL does; a backend whose targets run top-down
 * flips them against the target's height.
 */
import type { BlendFactors } from '../effects/compositeOp';

/** A rect of a target, in its pixels from its bottom-left corner. */
export interface GpuRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** How a texture is filtered: the nearest texel, or a blend of the nearest four. */
export type GpuFilter = 'nearest' | 'linear';
/** What a texture coordinate outside 0–1 samples: the edge texel, or the texture tiled. */
export type GpuWrap = 'clamp' | 'repeat';

/** How a texture is sampled. `mipmap` filters between levels on minification
 *  (GL's `LINEAR_MIPMAP_LINEAR`); a texture without levels must not set it. */
export interface GpuSampling {
  readonly min: GpuFilter;
  readonly mag: GpuFilter;
  readonly mipmap?: boolean;
  readonly wrapS: GpuWrap;
  readonly wrapT: GpuWrap;
}

/** A texture's texel format: four 8-bit normalized channels, or one. */
export type GpuTextureFormat = 'rgba8' | 'r8';

/** A texture source the browser decodes. */
export type GpuImageSource = ImageBitmap | ImageData | HTMLCanvasElement | HTMLImageElement;

/** A texture. Opaque: only the backend that made it reads it. */
export interface GpuTexture {
  readonly kind: 'texture';
}

/** A vertex or index buffer. */
export interface GpuBuffer {
  readonly kind: 'vertex' | 'index';
}

/** One float attribute of a vertex buffer, at the location the program links it to. */
export interface GpuVertexAttribute {
  readonly location: number;
  readonly components: 1 | 2 | 3 | 4;
  /** Bytes from the start of the vertex. */
  readonly offset: number;
}

/** One vertex buffer of a geometry, and the attributes read from each vertex in it. */
export interface GpuVertexBufferLayout {
  readonly buffer: GpuBuffer;
  /** Bytes per vertex; 0 for tightly packed. */
  readonly stride: number;
  readonly attributes: readonly GpuVertexAttribute[];
}

/** The integer type an index buffer holds. */
export type GpuIndexFormat = 'uint16' | 'uint32';

/** Vertex buffers and an index buffer, bound together for a draw. */
export interface GpuGeometryDesc {
  readonly vertexBuffers: readonly GpuVertexBufferLayout[];
  readonly indexBuffer: GpuBuffer;
  readonly indexFormat: GpuIndexFormat;
}

/** Geometry `createGeometry` made from a {@link GpuGeometryDesc}. Opaque: only the backend
 *  that made it reads it. */
export interface GpuGeometry {
  readonly kind: 'geometry';
  readonly indexFormat: GpuIndexFormat;
}

/** What a render target holds beside its color. */
export interface GpuTargetDesc {
  readonly width: number;
  readonly height: number;
  /** Samples a pixel; 0 single-sampled. A multisampled target's color cannot
   *  be sampled, only resolved. */
  readonly samples?: number;
  /** A stencil attachment: clips and even-odd fills need one. */
  readonly stencil?: boolean;
  /** A second color attachment the pick ids are drawn to. */
  readonly ids?: boolean;
  /** How the color texture samples, for a single-sampled target. */
  readonly filter?: GpuFilter;
}

/** An offscreen render target. `null` in a pass names the canvas. */
export interface GpuTarget {
  readonly kind: 'target';
  readonly width: number;
  readonly height: number;
  readonly samples: number;
  /** The color, for a single-sampled target. */
  readonly color: GpuTexture | null;
  /** The id attachment, for a target made with `ids`. */
  readonly ids: GpuTexture | null;
  /** GPU memory it holds now, every attachment and any copy a resolve made. */
  readonly bytes: number;
}

/** A pass: where it draws, and what it starts from. */
export interface GpuPassDesc {
  readonly target: GpuTarget | null;
  readonly viewport: GpuRect;
  /** Fragments outside are dropped, and a clear clears only inside. */
  readonly scissor?: GpuRect | null;
  /** Cleared on entry: the color to transparent black, the stencil to 0.
   *  Absent, the pass loads what the target holds. */
  readonly clear?: { readonly color?: boolean; readonly stencil?: boolean };
}

/** When a fragment passes the stencil test: always, or where the stencil equals `ref` under
 *  `readMask`. */
export type GpuStencilCompare = 'always' | 'equal';
/** What a passing fragment writes to the stencil, under `writeMask`: nothing, `ref`, the
 *  bitwise inverse of what is there, or 0. */
export type GpuStencilOp = 'keep' | 'replace' | 'invert' | 'zero';

/** The stencil a draw tests and writes. Fail and depth-fail always keep. */
export interface GpuStencilState {
  readonly compare: GpuStencilCompare;
  readonly ref: number;
  readonly readMask: number;
  readonly writeMask: number;
  readonly pass: GpuStencilOp;
}

/** Everything a draw is drawn under besides its uniforms, textures and geometry. */
export interface GpuDrawState {
  readonly program: GpuProgram;
  /** `null` writes the source over the destination unblended. */
  readonly blend: BlendFactors | null;
  /** Whether color attachment 0 is written. */
  readonly colorWrite: boolean;
  /** `null` neither tests nor writes the stencil. */
  readonly stencil: GpuStencilState | null;
  /** Whether the id attachment is written, on a target that has one. */
  readonly ids: boolean;
}

/** A uniform's element type, as GLSL names it. */
export type GpuUniformType =
  | 'float' | 'vec2' | 'vec3' | 'vec4'
  | 'int' | 'ivec2' | 'ivec3' | 'ivec4'
  | 'uint' | 'uvec2' | 'uvec3' | 'uvec4'
  | 'bool' | 'bvec2' | 'bvec3' | 'bvec4'
  | 'mat2' | 'mat3' | 'mat4' | 'mat2x2' | 'mat3x3' | 'mat4x4'
  | 'mat2x3' | 'mat2x4' | 'mat3x2' | 'mat3x4' | 'mat4x2' | 'mat4x3';

/** An array uniform: its element type as declared and its declared length. */
export interface GpuUniformArray {
  readonly type: string;
  readonly size: number;
}

/** The values `GpuProgram.set` uploads: a typed array, or plain numbers. */
export type GpuUniformData = Float32Array | Int32Array | Uint32Array | readonly number[];

/**
 * A linked program and the values it holds. Uniforms and textures are set by
 * name and kept by the program until set again, as GL keeps them; a name the
 * program does not declare is ignored.
 */
export interface GpuProgram {
  readonly kind: 'program';
  /** Whether the program writes the id output an id frame reads. */
  readonly writesIds: boolean;
  /** Record which names the program is written through. Names left out are
   *  ignored by every setter. */
  lookupUniforms(names: readonly string[]): void;
  lookupUniformArrays(decls: ReadonlyMap<string, { type: string; size: number }>): void;
  lookupAttributes(names: readonly string[]): void;
  /** Whether `name` is a uniform the program declares and was looked up. */
  has(name: string): boolean;
  array(name: string): GpuUniformArray | undefined;
  /** The location the program links attribute `name` to. */
  attribute(name: string): number | undefined;
  set1f(name: string, x: number): void;
  set2f(name: string, x: number, y: number): void;
  set4f(name: string, x: number, y: number, z: number, w: number): void;
  set1i(name: string, x: number): void;
  /** `data` as `count` elements of `type` from `offset` (elements of the
   *  array's own type), or all of it. A matrix is column-major. */
  set(name: string, type: GpuUniformType, data: GpuUniformData, offset?: number, count?: number): void;
  /** The texture a sampler samples; `index` names an element of a sampler array. */
  setTexture(name: string, texture: GpuTexture | null, index?: number): void;
}

/** A program's source in each language a backend can compile. WGSL is one
 *  whole module, entry points and all. */
export interface GpuProgramSource {
  readonly glsl?: { readonly vert: string; readonly frag: string };
  readonly wgsl?: string;
}

/** What `createProgram` takes beside the source. */
export interface GpuProgramOptions {
  /** Add the id output. Default `true`; `false` for a program that writes
   *  location 1 itself. */
  readonly ids?: boolean;
}

/** What a device reports of itself and its canvas target. */
export interface GpuLimits {
  /** `MAX_TEXTURE_SIZE`, as the backend reports it; `undefined` where it
   *  reports nothing usable. */
  readonly maxTextureSize: number | undefined;
  /** Samples a pixel of the canvas target; `undefined` where it reports none. */
  readonly samples: number | undefined;
  /** Whether the canvas target has a stencil buffer; `undefined` unknown. */
  readonly stencil: boolean | undefined;
}

/** How often a buffer's contents are rewritten: once, or often (GL's `STATIC_DRAW` and
 *  `DYNAMIC_DRAW`). */
export type GpuBufferUsage = 'static' | 'dynamic';

/** A texture's pixels, whole: from a decoded image, or tightly packed bytes. */
export type GpuTextureData =
  | { readonly source: GpuImageSource; readonly premultiply: boolean }
  | { readonly width: number; readonly height: number; readonly data: ArrayBufferView | null };

/** The backend. Everything it hands out is valid until the device's context
 *  is lost; the renderer rebuilds its resources on restore. */
export interface GpuDevice {
  /** The language the backend compiles programs from. */
  readonly language: 'glsl' | 'wgsl';
  readonly limits: GpuLimits;
  isContextLost(): boolean;
  /** The canvas target's size in pixels. */
  canvasSize(): { readonly width: number; readonly height: number };
  /** Put the device in its frame-start state, forgetting anything it believed
   *  about state some other user of the context may have changed. */
  beginFrame(): void;

  createProgram(source: GpuProgramSource, options?: GpuProgramOptions): GpuProgram;
  deleteProgram(program: GpuProgram): void;

  createBuffer(kind: GpuBuffer['kind'], init: number | ArrayBufferView, usage: GpuBufferUsage): GpuBuffer;
  /** Respecify the whole buffer: `init` bytes of nothing, or this data. */
  resizeBuffer(buffer: GpuBuffer, init: number | ArrayBufferView, usage: GpuBufferUsage): void;
  /** Write `length` elements of `data` from `srcOffset` (all of it by
   *  default) at `dstByteOffset`. */
  writeBuffer(buffer: GpuBuffer, dstByteOffset: number, data: ArrayBufferView, srcOffset?: number, length?: number): void;
  deleteBuffer(buffer: GpuBuffer): void;
  createGeometry(desc: GpuGeometryDesc): GpuGeometry;
  deleteGeometry(geometry: GpuGeometry): void;

  createTexture(format: GpuTextureFormat, sampling: GpuSampling, data: GpuTextureData): GpuTexture;
  /** Replace the whole texture's pixels. */
  writeTexture(texture: GpuTexture, data: GpuTextureData): void;
  /** Patch `width × height` texels at `x, y` from tightly packed bytes. */
  writeSubTexture(texture: GpuTexture, x: number, y: number, width: number, height: number, data: ArrayBufferView): void;
  generateMipmaps(texture: GpuTexture): void;
  setSampling(texture: GpuTexture, sampling: Partial<GpuSampling>): void;
  deleteTexture(texture: GpuTexture): void;

  createTarget(desc: GpuTargetDesc): GpuTarget;
  deleteTarget(target: GpuTarget): void;

  /** Start drawing into a target. Passes do not nest: end one before the next. */
  beginPass(desc: GpuPassDesc): void;
  endPass(): void;
  setViewport(rect: GpuRect): void;
  setScissor(rect: GpuRect | null): void;
  /** Zero the stencil bits `mask` holds, inside the scissor. */
  clearStencilBits(mask: number): void;
  /** Draw `count` indices of `geometry` from `firstIndex`, as triangles. */
  draw(state: GpuDrawState, geometry: GpuGeometry, count: number, firstIndex?: number): void;

  /** Copy the bottom-left `width × height` of multisampled `source` into
   *  `dest` at `x, y`. Not inside a pass. */
  resolve(source: GpuTarget, dest: GpuTarget, width: number, height: number, x: number, y: number): void;
  /** The id attachment's RGBA8 texels inside `rect`, rows bottom-up. */
  readIds(target: GpuTarget, rect: GpuRect): Promise<Uint8Array>;
  /** `readIds` answered at once, where the backend can. */
  readonly readIdsSync?: (target: GpuTarget, rect: GpuRect) => Uint8Array;
  /** The canvas's RGBA8 pixels inside `rect` as the last frame left them,
   *  premultiplied, rows bottom-up. */
  readCanvas(rect: GpuRect): Promise<Uint8Array>;
  /** `readCanvas` answered at once, where the backend can. */
  readonly readCanvasSync?: (rect: GpuRect) => Uint8Array;
  /** Free what the device holds of its own, once the one renderer drawing
   *  through it is done. Absent on a device renderers share. */
  dispose?(): void;
}
