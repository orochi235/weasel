# Review saturation for `renderer.gpu`

Snapshot `0269be874a5adbbc9f6a3bd2b580f6a1dd1dea4f`. The tracked working tree was clean at the start of review. Scope is the 17 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Texture upload failures and binding cache consistency | 1 | 1 | 0 |
| 2 | Program construction, link errors and stage ownership | 1 | 2 | 0 |
| 3 | Framebuffer attachment routing, resolve and readback | 0 | 2 | 1 |
| 4 | Buffer updates, index ownership and vertex layouts | 0 | 2 | 2 |
| 5 | Context resets, sampler assignment and uniform dispatch | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A failed texture upload leaves the binding cache out of sync

[glCache.ts](packages/renderer/src/gpu/webgl/glCache.ts#L218) · Pass 1 · Medium · Source-traced

The existing tainted-source test confirms that texImage2D can throw during creation. When it does, withTexture skips the unbind and cache update, so another draw in the frame may skip a required texture bind. The creation path also fails to delete the newly allocated texture handle.

### 2. Fragment shader allocation failure leaves the vertex shader allocated

[GlProgram.ts](packages/renderer/src/gpu/webgl/GlProgram.ts#L61) · Pass 2 · Low · Source-traced

The constructor creates and compiles the vertex stage before allocating the fragment stage. If the latter createShader returns null, compile throws before either stage reaches constructor cleanup. The vertex shader is never explicitly deleted.

Source and tests were left untouched.
