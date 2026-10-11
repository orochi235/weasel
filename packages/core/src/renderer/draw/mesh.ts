import type { Path } from '@weasel-js/geom';
import type { GLMeshHandle } from '../cache/GLMeshCache';
import { getMesh } from '../cache/cache';
import { tessellate, type Mesh } from '@weasel-js/geom/tessellate';
import type { DrawContext } from './drawContext';

/**
 * Tessellate a fill honoring ctx.flattenTolerance: default route is the
 * persistent Path-identity cache; a custom tolerance tessellates fresh, because
 * the persistent cache's key does not include tolerance.
 */
export function fillMesh(ctx: DrawContext, path: Path): Mesh {
  if (ctx.flattenTolerance !== undefined) {
    return tessellate(path, { flattenTolerance: ctx.flattenTolerance });
  }
  return getMesh(path);
}

/** Upload a mesh for its own draw. A freshly tessellated one rides the
 *  transient pool, freed at end of frame. */
export function meshHandle(ctx: DrawContext, mesh: Mesh): GLMeshHandle {
  if (ctx.flattenTolerance !== undefined) return ctx.meshCache.uploadTransient(mesh);
  return ctx.meshCache.handleFor(mesh);
}

export function fillMeshHandle(ctx: DrawContext, path: Path): GLMeshHandle {
  return meshHandle(ctx, fillMesh(ctx, path));
}
