import type { Mesh } from '@weasel-js/geom/tessellate';
import { POSITION_ATTRIBUTE_LOCATION } from '../shaders/ShaderProgram';
import type { GpuBuffer, GpuDevice, GpuGeometry, GpuVertexBufferLayout } from '../gpu/types';

export interface GLMeshHandle {
  readonly geometry: GpuGeometry;
  /** The positions, two floats a vertex at `POSITION_ATTRIBUTE_LOCATION`, and
   *  the indices: what a draw adding an attribute of its own builds on. */
  readonly vertices: GpuBuffer;
  readonly indices: GpuBuffer;
  readonly indexCount: number;
  readonly requiresStencil: boolean;
  readonly anchorA?: Uint32Array;
  readonly anchorB?: Uint32Array;
  readonly anchorT?: Float32Array;
}

/** A per-vertex attribute a mesh's geometry also carries, for the one
 *  program that draws that mesh. */
export interface MeshAttribute {
  readonly location: number;
  readonly size: 1 | 2 | 3 | 4;
  readonly data: Float32Array;
}

/** Resources to release when a Mesh is reclaimed by GC. */
interface MeshResources {
  geometry: GpuGeometry;
  vbo: GpuBuffer;
  ibo: GpuBuffer;
  extra?: GpuBuffer;
}

/**
 * Caches GPU buffers and geometry per `Mesh` identity. Upload happens lazily
 * on first `handleFor(mesh)` call.
 *
 * **GC-aware cleanup (deferred-delete queue):** we register each Mesh with a
 * `FinalizationRegistry`; when the Mesh is reclaimed, the finalizer pushes
 * its GPU resources onto an internal queue. The renderer
 * drains this queue at the start of each `render()` call (via
 * `drainPendingDeletes()`), when no draw is mid-flight. Finalizer timing is non-deterministic; resources may live
 * for a frame or two beyond their Mesh.
 *
 * The cache is context-bound; if the context is lost and re-created, the
 * renderer should construct a new GLMeshCache.
 */
export class GLMeshCache {
  private readonly map = new WeakMap<Mesh, GLMeshHandle>();
  /** Meshes this context has drawn at least once; see `uploadRecurring`. */
  private readonly seen = new WeakSet<Mesh>();
  private readonly finalizer: FinalizationRegistry<MeshResources>;
  /** Every persistent upload not yet freed, so `dispose` can reach them. */
  private readonly persistent = new Set<MeshResources>();
  private readonly pendingDeletes: MeshResources[] = [];
  private disposed = false;
  /** Transient resources allocated this frame; freed at end of render(). */
  private readonly transientThisFrame: MeshResources[] = [];

  constructor(
    private readonly gpu: GpuDevice,
  ) {
    this.finalizer = new FinalizationRegistry<MeshResources>((resources) => {
      // Defer the actual delete until the renderer's next render(): GC can
      // fire mid-draw inside dispatch().
      if (!this.persistent.delete(resources)) return;
      this.pendingDeletes.push(resources);
    });
  }

  handleFor(mesh: Mesh, attribute?: MeshAttribute): GLMeshHandle {
    const cached = this.map.get(mesh);
    if (cached) return cached;
    const { handle, resources } = this.upload(mesh, attribute);
    this.map.set(mesh, handle);
    this.persistent.add(resources);
    this.finalizer.register(mesh, resources, mesh);
    return handle;
  }

  /**
   * Upload a Mesh that the caller knows is single-use. Returns a handle backed
   * by fresh GL resources that the renderer frees at the end of the current
   * frame via `freeTransient()`, so transient meshes never wait on GC.
   */
  uploadTransient(mesh: Mesh, attribute?: MeshAttribute): GLMeshHandle {
    const { handle, resources } = this.upload(mesh, attribute);
    this.transientThisFrame.push(resources);
    return handle;
  }

  /**
   * Upload a Mesh that may or may not recur across frames. Its first sight in
   * *this* context takes `uploadTransient`; every later one takes the
   * persistent handle. One transient upload to find out is cheaper than
   * stranding a persistent VAO on a mesh that never returns, whose release
   * would wait on GC. The transient upload does not populate the persistent
   * map, so steady-state reuse begins on the third frame.
   */
  uploadRecurring(mesh: Mesh, attribute?: MeshAttribute): GLMeshHandle {
    if (this.seen.has(mesh)) return this.handleFor(mesh, attribute);
    this.seen.add(mesh);
    return this.uploadTransient(mesh, attribute);
  }

  /**
   * Free all transient resources allocated since the last call. Called by
   * the renderer at the end of each `render()`. Safe under context loss.
   */
  freeTransient(): void {
    if (this.transientThisFrame.length === 0) return;
    const gpu = this.gpu;
    if (gpu.isContextLost()) {
      this.transientThisFrame.length = 0;
      return;
    }
    for (const r of this.transientThisFrame) release(gpu, r);
    this.transientThisFrame.length = 0;
  }

  /** @internal — for tests asserting the transient-list size. */
  _transientCount(): number {
    return this.transientThisFrame.length;
  }

  /**
   * Free GL resources whose Mesh has been GC'd since the last drain.
   * Called by the renderer at the top of each `render()`, before any draws.
   */
  drainPendingDeletes(): void {
    if (this.pendingDeletes.length === 0) return;
    const gpu = this.gpu;
    if (gpu.isContextLost()) {
      this.pendingDeletes.length = 0;
      return;
    }
    for (const r of this.pendingDeletes) release(gpu, r);
    this.pendingDeletes.length = 0;
  }

  /**
   * Free every GL resource this cache holds — persistent, pending and
   * transient — and ignore finalizers from here on. Idempotent. Unlike the
   * other paths this does not wait on GC, which is what lets a renderer on a
   * context it does not own give back everything it uploaded.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.freeTransient();
    for (const r of this.persistent) this.pendingDeletes.push(r);
    this.persistent.clear();
    this.drainPendingDeletes();
  }

  /** @internal — for tests asserting the queue size. */
  _pendingDeleteCount(): number {
    return this.pendingDeletes.length;
  }

  /** @internal — for tests that need to simulate the finalizer firing. */
  _enqueueDeleteForTest(resources: MeshResources): void {
    this.pendingDeletes.push(resources);
  }

  private upload(mesh: Mesh, attribute?: MeshAttribute): { handle: GLMeshHandle; resources: MeshResources } {
    const gpu = this.gpu;
    const vbo = gpu.createBuffer('vertex', mesh.vertices, 'static');
    const extra = attribute ? gpu.createBuffer('vertex', attribute.data, 'static') : undefined;
    const ibo = gpu.createBuffer('index', mesh.indices, 'static');
    const vertexBuffers: GpuVertexBufferLayout[] = [
      { buffer: vbo, stride: 0, attributes: [{ location: POSITION_ATTRIBUTE_LOCATION, components: 2, offset: 0 }] },
    ];
    if (attribute && extra) {
      vertexBuffers.push({ buffer: extra, stride: 0, attributes: [{ location: attribute.location, components: attribute.size, offset: 0 }] });
    }
    const geometry = gpu.createGeometry({
      vertexBuffers,
      indexBuffer: ibo,
      indexFormat: 'uint32',
    });
    return {
      handle: {
        geometry,
        vertices: vbo,
        indices: ibo,
        indexCount: mesh.indices.length,
        requiresStencil: mesh.requiresStencil ?? false,
        anchorA: mesh.anchorA,
        anchorB: mesh.anchorB,
        anchorT: mesh.anchorT,
      },
      resources: { geometry, vbo, ibo, ...(extra ? { extra } : {}) },
    };
  }
}

function release(gpu: GpuDevice, r: MeshResources): void {
  gpu.deleteGeometry(r.geometry);
  gpu.deleteBuffer(r.vbo);
  gpu.deleteBuffer(r.ibo);
  if (r.extra) gpu.deleteBuffer(r.extra);
}
