# renderer.cache — blind review findings

No defects survived checking. Candidates examined and ruled out (traced against callers/types):

- GLImageCache `dispose` + `drainPendingDeletes`: a finalized texture leaves `textures` before it is queued, so nothing is deleted twice.
- GLImageCache/GLMeshCache finalizer registrations surviving `abandon`/`dispose`: the callback checks set membership first, and an unreachable cache's registry is collected with it — no leak.
- GradientRampAtlas `claimRow`: the free-row branch (`size < rows`) can't hand out an occupied row, because an LRU recycle deletes one key and then sets one, so `size` stays at `rows` once full; `wouldReshape` agrees with `claimRow` in every state.
- markerCommandCache key: placements and polylines read only `strokeWidth`, the widest vertex width, the tolerance, refs, spaces and trim (`strokeFlattening`, `markerPlacements`), all keyed or re-placed on trim change; `shapeDraws` reads only `stroke.paint`, whose change resets `draws`.
- strokeMeshCache/outlineStrokeMeshCache keys: every `Stroke` field that changes ribbon geometry is in the key (`dash` is `number[]`, `vertexWidths` is compared by reference or JSON); `metricKey` never sees `null`, because `ScreenSpace.metric` is non-null.
- GLTextureCache page/registered/plain id interplay: collisions are refused or warned as documented, and `sweep` never sees page ids.

## Files read
packages/renderer/src/cache/GLImageCache.ts
packages/renderer/src/cache/GLMeshCache.ts
packages/renderer/src/cache/GLTextureCache.ts
packages/renderer/src/cache/GradientRampAtlas.ts
packages/renderer/src/cache/cache.ts
packages/renderer/src/cache/markerCommandCache.ts
packages/renderer/src/cache/outlineMeshCache.ts
packages/renderer/src/cache/outlineStrokeMeshCache.ts
packages/renderer/src/cache/strokeMeshCache.ts
packages/renderer/src/cache/uploadPremultiplied.ts
packages/renderer/src/cache/whiteTexture.ts

<!-- done: 0 findings, files read: 11 -->
