import type { Path } from '@weasel-js/geom';
import type { GLMeshHandle } from '../cache/GLMeshCache';
import { getMesh } from '../cache/cache';
import type { Mesh } from '@weasel-js/geom/tessellate';
import type { DrawContext } from './drawContext';
import { worldFlattenTolerance } from './flattenTolerance';

/** The curve-flattening tolerance for a path drawn now, in its own units. */
export function flattenToleranceOf(ctx: DrawContext): number {
  return worldFlattenTolerance(ctx.flattenTolerance, ctx.state.transform);
}

/** The fill mesh for `path` at the tolerance it draws under now. */
export function fillMesh(ctx: DrawContext, path: Path): Mesh {
  return getMesh(path, flattenToleranceOf(ctx));
}

/** The persistent upload of a cached mesh. */
export function meshHandle(ctx: DrawContext, mesh: Mesh): GLMeshHandle {
  return ctx.meshCache.handleFor(mesh);
}

export function fillMeshHandle(ctx: DrawContext, path: Path): GLMeshHandle {
  return meshHandle(ctx, fillMesh(ctx, path));
}
