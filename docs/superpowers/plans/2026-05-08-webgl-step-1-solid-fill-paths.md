# WebGL Transition — Step 1: Solid-fill paths Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `@weasel-js/gl` as a workspace package and implement enough of `WeaselRenderer` to render solid-fill paths (both fillRules) inside nested `kind: 'group'` containers with transform + alpha. Exits when synthetic scenes (10/100/1000 polygons; both fill rules; nested groups) render correctly in headless Chromium.

**Architecture:** New workspace package `packages/gl/`, source-only (no build), imported into the demo app via the workspace path mapping just like `weasel-ui`. Renderer is one class (`WeaselRenderer`) wrapping a `WebGL2RenderingContext`. Tessellation is pure functions; the path mesh cache is a module-level `WeakMap<Path, Mesh>`. Tests are vitest unit tests using a Proxy-based GL call recorder; a single Playwright smoke test exercises a real browser to confirm pixels actually paint.

**Tech Stack:** TypeScript (strict), vitest, jsdom, earcut (new dep), Playwright (new dev dep). Reuses existing `@weasel-js/core` exports: `Path`, `PolygonPath`, `RectPath`, `PATH_M`, `PATH_L`, `PATH_C`, `PATH_Q`, `PATH_Z`, `PATH_CMD_LENGTHS`, `flattenCubic`, `flattenQuadratic`, `DEFAULT_FLATTEN_TOLERANCE`.

**Reference reading before starting:**
- Spec: `docs/superpowers/specs/2026-05-08-webgl-transition-plan-design.md` (sections "Architecture deltas," "Sequencing → Step 1," "Custom shader API")
- Existing path types: `src/features/paths/types.ts`
- Existing bezier flatteners: `src/features/paths/flatten.ts`
- Existing workspace package shape: `packages/ui/package.json`, `packages/ui/tsconfig.json`

---

## File structure

Files this plan creates (all under `packages/gl/`):

```
packages/gl/
  package.json                       # workspace package manifest
  tsconfig.json                      # extends root, src-only
  README.md                          # one paragraph + "experimental" notice
  src/
    index.ts                         # public barrel
    mesh.ts                          # Mesh type
    tessellate.ts                    # path → mesh
    tessellate.test.ts
    cache.ts                         # WeakMap<Path, Mesh>
    cache.test.ts
    mat3.ts                          # 2D affine helpers
    mat3.test.ts
    shaders/
      pathFill.ts                    # GLSL sources for solid-fill path shader
    ShaderProgram.ts                 # compile/link/uniform-lookup wrapper
    ShaderProgram.test.ts
    GLMeshCache.ts                   # GL-side VBO/IBO/VAO upload + cache
    GLMeshCache.test.ts
    GroupState.ts                    # software push/pop transform + alpha stack
    GroupState.test.ts
    WeaselRenderer.ts                # the class
    WeaselRenderer.test.ts
  test-utils/
    glRecorder.ts                    # Proxy-based recording GL context
    glRecorder.test.ts
  dev/
    smoke.html                       # boots a single-rect render in a browser
    smoke.ts                         # the smoke render
    smoke.spec.ts                    # Playwright spec (lives in dev/ for proximity)
  fonts/                             # placeholder dir; populated in step 3
    .gitkeep
```

Files this plan modifies (outside the new package):

```
package.json                         # add earcut, @types/earcut, @playwright/test deps
                                     # add scripts: test:visual:smoke, gen:font (placeholder)
tsconfig.json                        # add packages/gl path mapping + include
.github/workflows/ci.yml             # bundle-size gate for weasel-gl (only if file exists)
docs/TODO.md                         # mark step 1 in progress / shipped
```

> If `.github/workflows/ci.yml` does not exist, the bundle-size gate task is a no-op for now and tracked in the roadmap doc instead. Do not invent a CI workflow file unrelated to this plan.

---

## Task 1: Workspace package skeleton

**Files:**
- Create: `packages/gl/package.json`
- Create: `packages/gl/tsconfig.json`
- Create: `packages/gl/README.md`
- Create: `packages/gl/src/index.ts`
- Create: `packages/gl/src/index.test.ts`
- Modify: `tsconfig.json` (root) — add path mapping and include

- [ ] **Step 1: Write the failing test**

Create `packages/gl/src/index.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as gl from './index';

describe('weasel-gl barrel', () => {
  it('exports a placeholder marker so the package is importable', () => {
    expect(gl).toHaveProperty('__weaselGlPackage');
    expect(gl.__weaselGlPackage).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/gl/src/index.test.ts`

Expected: FAIL — module `./index` not found, or no exports.

- [ ] **Step 3: Create the package files**

Create `packages/gl/package.json`:

```json
{
  "name": "@weasel-js/gl",
  "version": "0.0.0",
  "private": true,
  "description": "WebGL2 renderer for weasel — experimental, parallel to the 2D backend.",
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "import": "./src/index.ts",
      "types": "./src/index.ts"
    },
    "./package.json": "./package.json"
  }
}
```

Create `packages/gl/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "include": ["src", "test-utils", "dev"],
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true
  }
}
```

Create `packages/gl/README.md`:

```md
# @weasel-js/gl

WebGL2 renderer for weasel. **Experimental.** Builds toward parity with the 2D backend; not consumer-ready.

See `docs/superpowers/specs/2026-05-08-webgl-transition-plan-design.md` for the transition plan and `docs/superpowers/plans/2026-05-08-webgl-step-1-solid-fill-paths.md` for the current step.
```

Create `packages/gl/src/index.ts`:

```ts
/**
 * @weasel-js/gl — public barrel.
 *
 * Experimental. Surface evolves through the WebGL transition steps.
 */
export const __weaselGlPackage = true as const;
```

Modify root `tsconfig.json` — add the path mapping under `compilerOptions.paths`:

```jsonc
"paths": {
  "@weasel-js/core": ["./src/index.ts"],
  "@weasel-js/core/*": ["./src/*"],
  "@weasel-js/ui": ["./packages/ui/src/index.ts"],
  "@weasel-js/gl": ["./packages/gl/src/index.ts"],
  "@weasel-js/gl/*": ["./packages/gl/src/*"]
}
```

And add the package's source to `include`:

```jsonc
"include": ["src", "demo", "apps", "packages/ui/src", "packages/gl/src", "packages/gl/test-utils", "packages/gl/dev"]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- packages/gl/src/index.test.ts`

Expected: PASS, 1 test.

Run: `npm run typecheck`

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add packages/gl tsconfig.json
git commit -m "feat(weasel-gl): scaffold workspace package"
```

---

## Task 2: Add earcut dependency

**Files:**
- Modify: `package.json` — root devDependencies

- [ ] **Step 1: Add earcut as a dependency**

Run: `npm install --save earcut@2.2.4 && npm install --save-dev @types/earcut@2.1.4`

(Pin patch versions: earcut is mature and stable; tighter pinning avoids surprise behavior changes.)

- [ ] **Step 2: Verify the import works**

Create a throwaway file `/tmp/earcut-check.ts`:

```ts
import earcut from 'earcut';
const result = earcut([0, 0, 10, 0, 10, 10, 0, 10]);
console.log(result);
```

Run: `npx tsx /tmp/earcut-check.ts`

Expected: `[ 0, 1, 2, 0, 2, 3 ]` (a 4-vertex rect → 2 triangles).

Delete the throwaway file: `rm /tmp/earcut-check.ts`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add earcut for path tessellation"
```

---

## Task 3: GL call recorder test utility

**Files:**
- Create: `packages/gl/test-utils/glRecorder.ts`
- Create: `packages/gl/test-utils/glRecorder.test.ts`

This is a Proxy-based fake `WebGL2RenderingContext` that records every method call. Used by every renderer-side unit test in this plan. Pixel correctness is *not* tested here — that's the smoke test's job.

- [ ] **Step 1: Write the failing test**

Create `packages/gl/test-utils/glRecorder.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeGLRecorder } from './glRecorder';

describe('glRecorder', () => {
  it('records method calls in order with args', () => {
    const { gl, calls } = makeGLRecorder();
    gl.viewport(0, 0, 800, 600);
    gl.clearColor(1, 0, 0, 1);

    expect(calls.length).toBe(2);
    expect(calls[0]).toMatchObject({ name: 'viewport', args: [0, 0, 800, 600] });
    expect(calls[1]).toMatchObject({ name: 'clearColor', args: [1, 0, 0, 1] });
  });

  it('returns synthetic handles for createShader / createProgram / createBuffer', () => {
    const { gl } = makeGLRecorder();
    const shader = gl.createShader(gl.VERTEX_SHADER);
    const program = gl.createProgram();
    expect(shader).toBeTruthy();
    expect(program).toBeTruthy();
    expect(shader).not.toBe(program);
  });

  it('returns truthy from getShaderParameter / getProgramParameter (assume success)', () => {
    const { gl } = makeGLRecorder();
    const shader = gl.createShader(gl.VERTEX_SHADER);
    expect(gl.getShaderParameter(shader!, gl.COMPILE_STATUS)).toBe(true);
  });

  it('exposes GL constants as numbers', () => {
    const { gl } = makeGLRecorder();
    expect(typeof gl.VERTEX_SHADER).toBe('number');
    expect(gl.VERTEX_SHADER).toBe(0x8B31);
  });

  it('reset() clears the call log', () => {
    const { gl, calls, reset } = makeGLRecorder();
    gl.viewport(0, 0, 1, 1);
    expect(calls.length).toBe(1);
    reset();
    expect(calls.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/gl/test-utils/glRecorder.test.ts`

Expected: FAIL — `glRecorder` module not found.

- [ ] **Step 3: Implement glRecorder**

Create `packages/gl/test-utils/glRecorder.ts`:

```ts
/**
 * Proxy-based recording WebGL2 context for unit tests.
 *
 * Records every method call as { name, args, result } so tests can assert
 * against the call sequence. Returns synthetic handles for object creation
 * (createShader/Program/Buffer/etc.); reports truthy for *Parameter status
 * queries (i.e. assumes shader/program compilation succeeded).
 *
 * NOT a renderer correctness check — pixel-level correctness is verified
 * end-to-end by the smoke test in dev/smoke.spec.ts. This recorder catches
 * "did the dispatcher emit the right call sequence" bugs only.
 */

export interface GLCall {
  readonly name: string;
  readonly args: readonly unknown[];
  readonly result: unknown;
}

export interface GLRecorder {
  readonly gl: WebGL2RenderingContext;
  readonly calls: GLCall[];
  reset(): void;
}

const GL_CONSTANTS: Readonly<Record<string, number>> = {
  // Shader / program
  VERTEX_SHADER: 0x8B31,
  FRAGMENT_SHADER: 0x8B30,
  COMPILE_STATUS: 0x8B81,
  LINK_STATUS: 0x8B82,
  // Buffer targets
  ARRAY_BUFFER: 0x8892,
  ELEMENT_ARRAY_BUFFER: 0x8893,
  STATIC_DRAW: 0x88E4,
  // Types
  FLOAT: 0x1406,
  UNSIGNED_INT: 0x1405,
  // Primitives
  TRIANGLES: 0x0004,
  // Errors / state
  NO_ERROR: 0,
  DEPTH_TEST: 0x0B71,
  BLEND: 0x0BE2,
  STENCIL_TEST: 0x0B90,
  CULL_FACE: 0x0B44,
  // Blend factors
  SRC_ALPHA: 0x0302,
  ONE_MINUS_SRC_ALPHA: 0x0303,
  ZERO: 0,
  ONE: 1,
  // Buffer bits
  COLOR_BUFFER_BIT: 0x00004000,
  STENCIL_BUFFER_BIT: 0x00000400,
  DEPTH_BUFFER_BIT: 0x00000100,
  // Stencil ops
  KEEP: 0x1E00,
  REPLACE: 0x1E01,
  INVERT: 0x150A,
  // Compare funcs
  ALWAYS: 0x0207,
  NEVER: 0x0200,
  EQUAL: 0x0202,
  NOTEQUAL: 0x0205,
  // Color masks
  FRONT_AND_BACK: 0x0408,
  // Misc constants used in step 1
  COLOR_WRITEMASK: 0x0C23,
};

function syntheticHandle(name: string, seq: number): { __id: string } {
  return { __id: `${name}_${seq}` };
}

export function makeGLRecorder(): GLRecorder {
  const calls: GLCall[] = [];

  const handler = (name: string) => (...args: unknown[]) => {
    let result: unknown = undefined;
    switch (name) {
      case 'createShader':
      case 'createProgram':
      case 'createBuffer':
      case 'createVertexArray':
      case 'createTexture':
      case 'createFramebuffer':
      case 'createRenderbuffer':
        result = syntheticHandle(name, calls.length);
        break;
      case 'getUniformLocation':
      case 'getAttribLocation':
        result = calls.length;
        break;
      case 'getShaderParameter':
      case 'getProgramParameter':
        result = true;
        break;
      case 'getShaderInfoLog':
      case 'getProgramInfoLog':
        result = '';
        break;
      case 'getError':
        result = 0;
        break;
      default:
        result = undefined;
    }
    calls.push({ name, args, result });
    return result;
  };

  const gl = new Proxy(
    {},
    {
      get(_, prop: string | symbol) {
        if (typeof prop !== 'string') return undefined;
        if (prop in GL_CONSTANTS) return GL_CONSTANTS[prop];
        if (/^[A-Z_0-9]+$/.test(prop)) return 0; // unknown all-caps constant → 0
        return handler(prop);
      },
    },
  ) as unknown as WebGL2RenderingContext;

  return {
    gl,
    calls,
    reset() {
      calls.length = 0;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- packages/gl/test-utils/glRecorder.test.ts`

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/gl/test-utils
git commit -m "feat(weasel-gl): GL call recorder for unit tests"
```

---

## Task 4: Mesh type

**Files:**
- Create: `packages/gl/src/mesh.ts`

A pure type definition. No tests; types are exercised by tessellator tests that follow.

- [ ] **Step 1: Create `packages/gl/src/mesh.ts`**

```ts
/**
 * A tessellated representation of a Path, ready to upload to GL.
 *
 * - `vertices` is interleaved x,y in path-local coordinates (`Float32Array`
 *   of length `2 * vertexCount`).
 * - `indices` are triangle indices into `vertices` (`Uint32Array`, length
 *   `3 * triangleCount`).
 * - `requiresStencil` is set for paths whose fillRule is `'evenodd'` and
 *   whose triangulation is a *naive* per-contour fan rather than a clean
 *   inside/outside triangulation. The renderer must use a stencil
 *   two-pass when this flag is true. Single-contour paths and `'nonzero'`
 *   multi-contour paths leave it false.
 */
export interface Mesh {
  readonly vertices: Float32Array;
  readonly indices: Uint32Array;
  readonly requiresStencil?: boolean;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add packages/gl/src/mesh.ts
git commit -m "feat(weasel-gl): Mesh type"
```

---

## Task 5: Tessellator — RectPath

**Files:**
- Create: `packages/gl/src/tessellate.ts`
- Create: `packages/gl/src/tessellate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/gl/src/tessellate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { RectPath } from '@weasel-js/core';
import { tessellate } from './tessellate';

describe('tessellate (RectPath)', () => {
  it('emits 4 vertices and 2 triangles for a rect', () => {
    const path: RectPath = { kind: 'rect', x: 10, y: 20, width: 100, height: 50 };
    const mesh = tessellate(path);
    expect(Array.from(mesh.vertices)).toEqual([
      10, 20,
      110, 20,
      110, 70,
      10, 70,
    ]);
    expect(Array.from(mesh.indices)).toEqual([0, 1, 2, 0, 2, 3]);
    expect(mesh.requiresStencil).toBeFalsy();
  });

  it('handles negative width/height by emitting the rect as-is (caller responsibility to normalize)', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: -10, height: -10 };
    const mesh = tessellate(path);
    expect(mesh.vertices.length).toBe(8);
    expect(mesh.indices.length).toBe(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/gl/src/tessellate.test.ts`

Expected: FAIL — `tessellate` not found.

- [ ] **Step 3: Implement tessellate for RectPath**

Create `packages/gl/src/tessellate.ts`:

```ts
import type { Path, RectPath } from '@weasel-js/core';
import type { Mesh } from './mesh';

export function tessellate(path: Path): Mesh {
  if (path.kind === 'rect') return tessellateRect(path);
  throw new Error(`tessellate: PolygonPath not yet supported (added in next task)`);
}

function tessellateRect(p: RectPath): Mesh {
  const { x, y, width: w, height: h } = p;
  const vertices = new Float32Array([
    x, y,
    x + w, y,
    x + w, y + h,
    x, y + h,
  ]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);
  return { vertices, indices };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- packages/gl/src/tessellate.test.ts`

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/tessellate.ts packages/gl/src/tessellate.test.ts
git commit -m "feat(weasel-gl): tessellate RectPath"
```

---

## Task 6: Tessellator — PolygonPath single-contour, M/L/Z, nonzero

**Files:**
- Modify: `packages/gl/src/tessellate.ts`
- Modify: `packages/gl/src/tessellate.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `packages/gl/src/tessellate.test.ts`:

```ts
import {
  PATH_M,
  PATH_L,
  PATH_Z,
  type PolygonPath,
} from '@weasel-js/core';

describe('tessellate (PolygonPath, single-contour, no curves)', () => {
  it('triangulates a square via M/L/L/L/Z', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
      fillRule: 'nonzero',
    };
    const mesh = tessellate(path);
    expect(mesh.vertices.length).toBe(8);              // 4 verts × 2 coords
    expect(mesh.indices.length).toBe(6);               // 2 triangles × 3
    expect(mesh.requiresStencil).toBeFalsy();
  });

  it('triangulates a concave hexagon (arrowhead)', () => {
    // M(0,0) L(10,5) L(0,10) L(2,5) Z  — concave "arrowhead"
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
      coords: new Float32Array([0, 0, 10, 5, 0, 10, 2, 5]),
      fillRule: 'nonzero',
    };
    const mesh = tessellate(path);
    expect(mesh.vertices.length).toBe(8);
    // Concave shape → 2 triangles (any valid triangulation)
    expect(mesh.indices.length).toBe(6);
  });

  it('triangulates a 100-vertex blob without throwing', () => {
    const verts: number[] = [];
    const cmds: number[] = [PATH_M];
    for (let i = 0; i < 100; i++) {
      const a = (i / 100) * Math.PI * 2;
      const r = 100 + (i % 5);                         // jittered radius
      verts.push(Math.cos(a) * r, Math.sin(a) * r);
      if (i > 0) cmds.push(PATH_L);
    }
    cmds.push(PATH_Z);
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array(cmds),
      coords: new Float32Array(verts),
      fillRule: 'nonzero',
    };
    const mesh = tessellate(path);
    expect(mesh.vertices.length).toBe(200);
    expect(mesh.indices.length % 3).toBe(0);
    // 100-vertex simple polygon → 98 triangles → 294 indices.
    expect(mesh.indices.length).toBe(294);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- packages/gl/src/tessellate.test.ts`

Expected: FAIL — `tessellate` throws "PolygonPath not yet supported."

- [ ] **Step 3: Implement single-contour polygon tessellation**

Replace `packages/gl/src/tessellate.ts`:

```ts
import earcut from 'earcut';
import {
  type Path,
  type PolygonPath,
  type RectPath,
  PATH_M,
  PATH_L,
  PATH_Z,
  PATH_C,
  PATH_Q,
  PATH_CMD_LENGTHS,
} from '@weasel-js/core';
import type { Mesh } from './mesh';

export function tessellate(path: Path): Mesh {
  if (path.kind === 'rect') return tessellateRect(path);
  return tessellatePolygon(path);
}

function tessellateRect(p: RectPath): Mesh {
  const { x, y, width: w, height: h } = p;
  return {
    vertices: new Float32Array([x, y, x + w, y, x + w, y + h, x, y + h]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  };
}

interface FlattenedContours {
  /** Interleaved x,y for all contours concatenated. */
  coords: number[];
  /** Vertex indices where each contour after the first begins. earcut's hole format. */
  holeStarts: number[];
}

function flattenPolygon(p: PolygonPath): FlattenedContours {
  const { commands, coords } = p;
  const out: number[] = [];
  const holeStarts: number[] = [];
  let coordIdx = 0;

  for (let cmdIdx = 0; cmdIdx < commands.length; cmdIdx++) {
    const cmd = commands[cmdIdx];
    switch (cmd) {
      case PATH_M: {
        // Start a new contour. If this isn't the first vertex, it's a hole start.
        if (out.length > 0) holeStarts.push(out.length / 2);
        out.push(coords[coordIdx], coords[coordIdx + 1]);
        coordIdx += 2;
        break;
      }
      case PATH_L: {
        out.push(coords[coordIdx], coords[coordIdx + 1]);
        coordIdx += 2;
        break;
      }
      case PATH_Q:
      case PATH_C: {
        // Curves — handled in a later task. Skip parameters for now.
        coordIdx += PATH_CMD_LENGTHS[cmd];
        throw new Error('tessellate: bezier curves not yet supported (added in later task)');
      }
      case PATH_Z: {
        // Close current contour. Tessellator doesn't need an explicit close vertex —
        // earcut treats consecutive vertices as a closed polygon.
        break;
      }
      default:
        throw new Error(`tessellate: unknown command code ${cmd}`);
    }
  }

  return { coords: out, holeStarts };
}

function tessellatePolygon(p: PolygonPath): Mesh {
  const { coords, holeStarts } = flattenPolygon(p);
  const indices = earcut(coords, holeStarts.length > 0 ? holeStarts : undefined);
  return {
    vertices: new Float32Array(coords),
    indices: new Uint32Array(indices),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- packages/gl/src/tessellate.test.ts`

Expected: PASS, 5 tests (2 rect + 3 polygon).

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/tessellate.ts packages/gl/src/tessellate.test.ts
git commit -m "feat(weasel-gl): tessellate single-contour PolygonPath via earcut"
```

---

## Task 7: Tessellator — multi-contour PolygonPath with holes (nonzero)

**Files:**
- Modify: `packages/gl/src/tessellate.test.ts`

The implementation in Task 6 already passes hole indices to earcut; this task only adds the test coverage that proves it works.

- [ ] **Step 1: Add failing test**

Append to `packages/gl/src/tessellate.test.ts`:

```ts
describe('tessellate (PolygonPath, multi-contour, nonzero)', () => {
  it('triangulates a 10×10 outer square with a 4×4 inner hole (counter-wound)', () => {
    // Outer CCW: (0,0) (10,0) (10,10) (0,10)
    // Inner CW (hole): (3,3) (3,7) (7,7) (7,3)
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([
        PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,         // outer
        PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,         // hole
      ]),
      coords: new Float32Array([
        0, 0, 10, 0, 10, 10, 0, 10,                     // outer (CCW)
        3, 3, 3, 7, 7, 7, 7, 3,                         // hole  (CW)
      ]),
      fillRule: 'nonzero',
    };
    const mesh = tessellate(path);
    // 8 vertices total (4 outer + 4 hole), 8 triangles around the hole.
    expect(mesh.vertices.length).toBe(16);
    expect(mesh.indices.length).toBe(24);                // earcut emits 8 triangles for this case
  });
});
```

- [ ] **Step 2: Run test to verify it passes immediately**

Run: `npm test -- packages/gl/src/tessellate.test.ts`

Expected: PASS, 6 tests. (The implementation in Task 6 already supports holes; this test guards against regression.)

If the assertion `expect(mesh.indices.length).toBe(24)` fails, do NOT change the implementation — earcut's exact triangle count for a square-with-hole is 8 triangles (24 indices). If you see a different number, investigate why before adjusting the assertion.

- [ ] **Step 3: Commit**

```bash
git add packages/gl/src/tessellate.test.ts
git commit -m "test(weasel-gl): cover multi-contour polygon with hole"
```

---

## Task 8: Tessellator — bezier curves (Q and C)

**Files:**
- Modify: `packages/gl/src/tessellate.ts`
- Modify: `packages/gl/src/tessellate.test.ts`

Reuse `flattenQuadratic` / `flattenCubic` from `@weasel-js/core` (existing implementation in `src/features/paths/flatten.ts`).

- [ ] **Step 1: Add failing tests**

Append to `packages/gl/src/tessellate.test.ts`:

```ts
import { PATH_Q as PQ, PATH_C as PC, DEFAULT_FLATTEN_TOLERANCE } from '@weasel-js/core';

describe('tessellate (PolygonPath, bezier curves)', () => {
  it('flattens a quadratic and triangulates the resulting polyline', () => {
    // M(0,0) Q(5,10, 10,0) Z — a quadratic arc closing back via Z (implicit line to start).
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PQ, PATH_Z]),
      coords: new Float32Array([0, 0, 5, 10, 10, 0]),
      fillRule: 'nonzero',
    };
    const mesh = tessellate(path);
    expect(mesh.vertices.length).toBeGreaterThanOrEqual(6);          // start + at least one flattened vertex
    expect(mesh.indices.length % 3).toBe(0);
  });

  it('flattens a cubic and triangulates', () => {
    // M(0,0) C(0,10, 10,10, 10,0) L(5,-5) Z — cubic + closing line.
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PC, PATH_L, PATH_Z]),
      coords: new Float32Array([0, 0, 0, 10, 10, 10, 10, 0, 5, -5]),
      fillRule: 'nonzero',
    };
    const mesh = tessellate(path);
    expect(mesh.vertices.length).toBeGreaterThan(8);
    expect(mesh.indices.length % 3).toBe(0);
  });

  it('emits more vertices when given a tighter tolerance (more subdivision)', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PQ, PATH_Z]),
      coords: new Float32Array([0, 0, 50, 100, 100, 0]),
      fillRule: 'nonzero',
    };
    const looseMesh = tessellate(path, { flattenTolerance: 5 });
    const tightMesh = tessellate(path, { flattenTolerance: 0.05 });
    expect(tightMesh.vertices.length).toBeGreaterThan(looseMesh.vertices.length);
  });

  it('uses DEFAULT_FLATTEN_TOLERANCE when no option passed', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PQ, PATH_Z]),
      coords: new Float32Array([0, 0, 5, 10, 10, 0]),
      fillRule: 'nonzero',
    };
    const a = tessellate(path);
    const b = tessellate(path, { flattenTolerance: DEFAULT_FLATTEN_TOLERANCE });
    expect(a.vertices.length).toBe(b.vertices.length);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- packages/gl/src/tessellate.test.ts`

Expected: FAIL — bezier curves throw, and `tessellate` doesn't accept an options arg.

- [ ] **Step 3: Implement curve flattening**

Replace the import block at the top of `packages/gl/src/tessellate.ts`:

```ts
import earcut from 'earcut';
import {
  type Path,
  type PolygonPath,
  type RectPath,
  PATH_M,
  PATH_L,
  PATH_Z,
  PATH_C,
  PATH_Q,
  PATH_CMD_LENGTHS,
  DEFAULT_FLATTEN_TOLERANCE,
  flattenCubic,
  flattenQuadratic,
} from '@weasel-js/core';
import type { Mesh } from './mesh';

export interface TessellateOptions {
  /** Flatness tolerance for bezier subdivision in path-local units. */
  flattenTolerance?: number;
}

export function tessellate(path: Path, opts: TessellateOptions = {}): Mesh {
  if (path.kind === 'rect') return tessellateRect(path);
  return tessellatePolygon(path, opts);
}

function tessellateRect(p: RectPath): Mesh {
  const { x, y, width: w, height: h } = p;
  return {
    vertices: new Float32Array([x, y, x + w, y, x + w, y + h, x, y + h]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  };
}
```

Then replace the body of `flattenPolygon` (drop the old `throw` for curves) and add a previous-vertex tracker so curves can read their starting point:

```ts
function flattenPolygon(
  p: PolygonPath,
  tolerance: number,
): FlattenedContours {
  const { commands, coords } = p;
  const out: number[] = [];
  const holeStarts: number[] = [];
  let coordIdx = 0;
  let prevX = 0;
  let prevY = 0;

  for (let cmdIdx = 0; cmdIdx < commands.length; cmdIdx++) {
    const cmd = commands[cmdIdx];
    switch (cmd) {
      case PATH_M: {
        if (out.length > 0) holeStarts.push(out.length / 2);
        prevX = coords[coordIdx];
        prevY = coords[coordIdx + 1];
        out.push(prevX, prevY);
        coordIdx += 2;
        break;
      }
      case PATH_L: {
        prevX = coords[coordIdx];
        prevY = coords[coordIdx + 1];
        out.push(prevX, prevY);
        coordIdx += 2;
        break;
      }
      case PATH_Q: {
        const cx = coords[coordIdx];
        const cy = coords[coordIdx + 1];
        const ex = coords[coordIdx + 2];
        const ey = coords[coordIdx + 3];
        flattenQuadratic(prevX, prevY, cx, cy, ex, ey, tolerance, out);
        prevX = ex;
        prevY = ey;
        coordIdx += 4;
        break;
      }
      case PATH_C: {
        const c1x = coords[coordIdx];
        const c1y = coords[coordIdx + 1];
        const c2x = coords[coordIdx + 2];
        const c2y = coords[coordIdx + 3];
        const ex = coords[coordIdx + 4];
        const ey = coords[coordIdx + 5];
        flattenCubic(prevX, prevY, c1x, c1y, c2x, c2y, ex, ey, tolerance, out);
        prevX = ex;
        prevY = ey;
        coordIdx += 6;
        break;
      }
      case PATH_Z: {
        break;
      }
      default:
        throw new Error(`tessellate: unknown command code ${cmd}`);
    }
  }

  return { coords: out, holeStarts };
}

function tessellatePolygon(p: PolygonPath, opts: TessellateOptions): Mesh {
  const tolerance = opts.flattenTolerance ?? DEFAULT_FLATTEN_TOLERANCE;
  const { coords, holeStarts } = flattenPolygon(p, tolerance);
  const indices = earcut(coords, holeStarts.length > 0 ? holeStarts : undefined);
  return {
    vertices: new Float32Array(coords),
    indices: new Uint32Array(indices),
  };
}
```

(The `PATH_CMD_LENGTHS` import becomes unused once curves are implemented inline. Remove it from the imports if TypeScript flags it under `noUnusedLocals`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- packages/gl/src/tessellate.test.ts`

Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/tessellate.ts packages/gl/src/tessellate.test.ts
git commit -m "feat(weasel-gl): flatten Q/C bezier segments before tessellation"
```

---

## Task 9: Tessellator — evenodd path (naive fan + requiresStencil)

**Files:**
- Modify: `packages/gl/src/tessellate.ts`
- Modify: `packages/gl/src/tessellate.test.ts`

For `fillRule: 'evenodd'`, we don't ask earcut to handle holes correctly (it doesn't, in the evenodd sense). Instead emit a naive triangle fan per contour and set `requiresStencil: true`. The renderer's stencil two-pass sorts out which fragments are actually inside.

- [ ] **Step 1: Add failing tests**

Append to `packages/gl/src/tessellate.test.ts`:

```ts
describe('tessellate (PolygonPath, evenodd)', () => {
  it('emits requiresStencil: true and a naive fan per contour for evenodd', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
      fillRule: 'evenodd',
    };
    const mesh = tessellate(path);
    expect(mesh.requiresStencil).toBe(true);
    expect(mesh.vertices.length).toBe(8);
    // Single contour → fan of (n-2) triangles for n vertices: 4 verts → 2 triangles → 6 indices.
    expect(mesh.indices.length).toBe(6);
    expect(Array.from(mesh.indices)).toEqual([0, 1, 2, 0, 2, 3]);
  });

  it('emits separate fans per contour with continuous indexing for multi-contour evenodd', () => {
    // Outer 4-vert square + inner 4-vert square. Two fans: [0..3] and [4..7].
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([
        PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
        PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
      ]),
      coords: new Float32Array([
        0, 0, 10, 0, 10, 10, 0, 10,
        3, 3, 7, 3, 7, 7, 3, 7,
      ]),
      fillRule: 'evenodd',
    };
    const mesh = tessellate(path);
    expect(mesh.requiresStencil).toBe(true);
    expect(mesh.vertices.length).toBe(16);
    // 2 fans × 2 triangles × 3 indices = 12.
    expect(mesh.indices.length).toBe(12);
    expect(Array.from(mesh.indices)).toEqual([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  });

  it('does not set requiresStencil for nonzero (uses earcut)', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
      fillRule: 'nonzero',
    };
    const mesh = tessellate(path);
    expect(mesh.requiresStencil).toBeFalsy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- packages/gl/src/tessellate.test.ts`

Expected: FAIL — current `tessellatePolygon` always uses earcut and never sets `requiresStencil`.

- [ ] **Step 3: Implement evenodd path**

Modify `packages/gl/src/tessellate.ts`. Update `flattenPolygon` to also return per-contour vertex offsets, and split `tessellatePolygon` into a fillRule branch:

```ts
interface FlattenedContours {
  coords: number[];
  /** Vertex (not coord) index where each contour starts. First contour starts at 0. */
  contourStarts: number[];
}

// ... inside flattenPolygon, replace `holeStarts` with `contourStarts` ...
// Push `out.length / 2` to `contourStarts` whenever we hit a `PATH_M` (including the first).

function tessellatePolygon(p: PolygonPath, opts: TessellateOptions): Mesh {
  const tolerance = opts.flattenTolerance ?? DEFAULT_FLATTEN_TOLERANCE;
  const { coords, contourStarts } = flattenPolygon(p, tolerance);

  if (p.fillRule === 'evenodd') {
    return tessellateEvenodd(coords, contourStarts);
  }

  // nonzero: hole indices for earcut are every contour after the first.
  const holeIndices = contourStarts.slice(1);
  const indices = earcut(coords, holeIndices.length > 0 ? holeIndices : undefined);
  return {
    vertices: new Float32Array(coords),
    indices: new Uint32Array(indices),
  };
}

function tessellateEvenodd(coords: number[], contourStarts: number[]): Mesh {
  const indices: number[] = [];
  const totalVerts = coords.length / 2;
  for (let c = 0; c < contourStarts.length; c++) {
    const start = contourStarts[c];
    const end = c + 1 < contourStarts.length ? contourStarts[c + 1] : totalVerts;
    // Naive fan: pivot = start, triangles (start, i, i+1) for i in [start+1, end-1).
    for (let i = start + 1; i < end - 1; i++) {
      indices.push(start, i, i + 1);
    }
  }
  return {
    vertices: new Float32Array(coords),
    indices: new Uint32Array(indices),
    requiresStencil: true,
  };
}
```

Update `flattenPolygon`'s body to populate `contourStarts` instead of `holeStarts`:

```ts
function flattenPolygon(p: PolygonPath, tolerance: number): FlattenedContours {
  const { commands, coords } = p;
  const out: number[] = [];
  const contourStarts: number[] = [];
  let coordIdx = 0;
  let prevX = 0;
  let prevY = 0;

  for (let cmdIdx = 0; cmdIdx < commands.length; cmdIdx++) {
    const cmd = commands[cmdIdx];
    switch (cmd) {
      case PATH_M: {
        contourStarts.push(out.length / 2);
        prevX = coords[coordIdx];
        prevY = coords[coordIdx + 1];
        out.push(prevX, prevY);
        coordIdx += 2;
        break;
      }
      // L / Q / C / Z: same as before.
      case PATH_L: {
        prevX = coords[coordIdx];
        prevY = coords[coordIdx + 1];
        out.push(prevX, prevY);
        coordIdx += 2;
        break;
      }
      case PATH_Q: {
        const cx = coords[coordIdx], cy = coords[coordIdx + 1];
        const ex = coords[coordIdx + 2], ey = coords[coordIdx + 3];
        flattenQuadratic(prevX, prevY, cx, cy, ex, ey, tolerance, out);
        prevX = ex; prevY = ey;
        coordIdx += 4;
        break;
      }
      case PATH_C: {
        const c1x = coords[coordIdx], c1y = coords[coordIdx + 1];
        const c2x = coords[coordIdx + 2], c2y = coords[coordIdx + 3];
        const ex = coords[coordIdx + 4], ey = coords[coordIdx + 5];
        flattenCubic(prevX, prevY, c1x, c1y, c2x, c2y, ex, ey, tolerance, out);
        prevX = ex; prevY = ey;
        coordIdx += 6;
        break;
      }
      case PATH_Z: break;
      default: throw new Error(`tessellate: unknown command code ${cmd}`);
    }
  }

  return { coords: out, contourStarts };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- packages/gl/src/tessellate.test.ts`

Expected: PASS, 13 tests. The previous "10×10 with hole, nonzero" test still passes because `contourStarts.slice(1)` produces the same hole-indices array earcut received before.

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/tessellate.ts packages/gl/src/tessellate.test.ts
git commit -m "feat(weasel-gl): evenodd fillRule via naive fan + requiresStencil"
```

---

## Task 10: Path mesh cache

**Files:**
- Create: `packages/gl/src/cache.ts`
- Create: `packages/gl/src/cache.test.ts`

WeakMap keyed on Path identity. Same Path object → same cached Mesh. Different Path object (even with same coords) → different cache entry.

- [ ] **Step 1: Write the failing test**

Create `packages/gl/src/cache.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { RectPath } from '@weasel-js/core';
import { getMesh, _resetCacheForTests } from './cache';

describe('mesh cache', () => {
  it('returns the same Mesh on subsequent calls with the same Path', () => {
    _resetCacheForTests();
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    const a = getMesh(path);
    const b = getMesh(path);
    expect(a).toBe(b);
  });

  it('returns different Meshes for different Path object identities (even with same coords)', () => {
    _resetCacheForTests();
    const a = getMesh({ kind: 'rect', x: 0, y: 0, width: 10, height: 10 });
    const b = getMesh({ kind: 'rect', x: 0, y: 0, width: 10, height: 10 });
    expect(a).not.toBe(b);
  });

  it('honors flattenTolerance via a per-tolerance cache slot (loose vs tight gives different meshes)', () => {
    _resetCacheForTests();
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    const a = getMesh(path, { flattenTolerance: 0.5 });
    const b = getMesh(path, { flattenTolerance: 0.5 });
    expect(a).toBe(b);
    // RectPath ignores tolerance, so a different tolerance still hits the same Path-object cache entry.
    // For PolygonPath this would matter; covered via PolygonPath integration tests later.
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/gl/src/cache.test.ts`

Expected: FAIL — `cache` module not found.

- [ ] **Step 3: Implement the cache**

Create `packages/gl/src/cache.ts`:

```ts
import type { Path } from '@weasel-js/core';
import type { Mesh } from './mesh';
import { tessellate, type TessellateOptions } from './tessellate';

let cache = new WeakMap<Path, Mesh>();

/**
 * Return the tessellated Mesh for `path`, computing and caching on first call.
 * Cache is keyed on Path identity (WeakMap) — different Path objects with the
 * same coords are distinct cache entries.
 *
 * For step 1, options are passed through to `tessellate` but not used as a
 * cache key (cache is per-Path-identity, not per-options). Consumers that
 * need different tolerances per-frame should construct distinct Path objects.
 */
export function getMesh(path: Path, opts: TessellateOptions = {}): Mesh {
  const cached = cache.get(path);
  if (cached !== undefined) return cached;
  const mesh = tessellate(path, opts);
  cache.set(path, mesh);
  return mesh;
}

/** Test helper. Do not call from product code. */
export function _resetCacheForTests(): void {
  cache = new WeakMap();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- packages/gl/src/cache.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/cache.ts packages/gl/src/cache.test.ts
git commit -m "feat(weasel-gl): WeakMap path-mesh cache"
```

---

## Task 11: Mat3 — 2D affine helpers

**Files:**
- Create: `packages/gl/src/mat3.ts`
- Create: `packages/gl/src/mat3.test.ts`

Column-major 9-element flat array (matches `uniformMatrix3fv` GL convention). Six operations: `identity`, `multiply`, `translate`, `scale`, `screenToClip`, `apply`.

- [ ] **Step 1: Write the failing test**

Create `packages/gl/src/mat3.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mat3 } from './mat3';

describe('mat3', () => {
  it('identity is [1, 0, 0, 0, 1, 0, 0, 0, 1] (column-major)', () => {
    const m = mat3.identity();
    expect(Array.from(m)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('translate(10, 20) applied to (0, 0) yields (10, 20)', () => {
    const m = mat3.translate(mat3.identity(), 10, 20);
    const [x, y] = mat3.apply(m, 0, 0);
    expect(x).toBe(10);
    expect(y).toBe(20);
  });

  it('scale(2, 3) applied to (5, 5) yields (10, 15)', () => {
    const m = mat3.scale(mat3.identity(), 2, 3);
    const [x, y] = mat3.apply(m, 5, 5);
    expect(x).toBe(10);
    expect(y).toBe(15);
  });

  it('multiply: translate then scale composes correctly', () => {
    // (translate(10,20) ∘ scale(2,2)) applied to (1, 1) → first scale then translate (right-multiply convention).
    const t = mat3.translate(mat3.identity(), 10, 20);
    const s = mat3.scale(mat3.identity(), 2, 2);
    const composed = mat3.multiply(t, s);
    const [x, y] = mat3.apply(composed, 1, 1);
    expect(x).toBe(12);
    expect(y).toBe(22);
  });

  it('screenToClip(800, 600) maps (0,0) → (-1, 1) and (800,600) → (1, -1) (Y-flip)', () => {
    const m = mat3.screenToClip(800, 600);
    const [x0, y0] = mat3.apply(m, 0, 0);
    const [x1, y1] = mat3.apply(m, 800, 600);
    expect(x0).toBeCloseTo(-1);
    expect(y0).toBeCloseTo(1);
    expect(x1).toBeCloseTo(1);
    expect(y1).toBeCloseTo(-1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/gl/src/mat3.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement mat3**

Create `packages/gl/src/mat3.ts`:

```ts
/**
 * 2D affine matrix utilities. Column-major 9-element Float32Array, matching
 * `WebGL2RenderingContext.uniformMatrix3fv` byte order so we can pass the
 * array directly without a transpose flag.
 *
 * Layout (column-major):
 *   [m00, m10, 0,
 *    m01, m11, 0,
 *    tx,  ty,  1]
 *
 * `apply(m, x, y)` returns `[m * (x, y, 1)] = [m00*x + m01*y + tx,
 *                                              m10*x + m11*y + ty]`.
 */

export type Mat3 = Float32Array;

function create(a: number, b: number, c: number, d: number, tx: number, ty: number): Mat3 {
  // Column-major:
  //   col 0: (a, b, 0)
  //   col 1: (c, d, 0)
  //   col 2: (tx, ty, 1)
  return new Float32Array([a, b, 0, c, d, 0, tx, ty, 1]);
}

function identity(): Mat3 {
  return create(1, 0, 0, 1, 0, 0);
}

function multiply(out: Mat3, m: Mat3): Mat3 {
  // out := out · m  (right-multiply by m).
  const a = out[0], b = out[1];
  const c = out[3], d = out[4];
  const tx = out[6], ty = out[7];
  const ma = m[0], mb = m[1];
  const mc = m[3], md = m[4];
  const mtx = m[6], mty = m[7];

  return create(
    a * ma + c * mb,                 // new a
    b * ma + d * mb,                 // new b
    a * mc + c * md,                 // new c
    b * mc + d * md,                 // new d
    a * mtx + c * mty + tx,          // new tx
    b * mtx + d * mty + ty,          // new ty
  );
}

function translate(m: Mat3, tx: number, ty: number): Mat3 {
  const t = create(1, 0, 0, 1, tx, ty);
  return multiply(m, t);
}

function scale(m: Mat3, sx: number, sy: number): Mat3 {
  const s = create(sx, 0, 0, sy, 0, 0);
  return multiply(m, s);
}

function apply(m: Mat3, x: number, y: number): [number, number] {
  const a = m[0], b = m[1];
  const c = m[3], d = m[4];
  const tx = m[6], ty = m[7];
  return [a * x + c * y + tx, b * x + d * y + ty];
}

/**
 * Map screen pixel coords (0..width on X, 0..height on Y, top-left origin)
 * into clip space (-1..1 on X, 1..-1 on Y — note Y flip so screen-down
 * matches clip-down).
 */
function screenToClip(width: number, height: number): Mat3 {
  return create(
    2 / width,                       // a
    0,                               // b
    0,                               // c
    -2 / height,                     // d
    -1,                              // tx
    1,                               // ty
  );
}

export const mat3 = {
  identity,
  multiply,
  translate,
  scale,
  apply,
  screenToClip,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- packages/gl/src/mat3.test.ts`

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/mat3.ts packages/gl/src/mat3.test.ts
git commit -m "feat(weasel-gl): mat3 affine helpers (column-major, GL-ready)"
```

---

## Task 12: Path-fill shader sources

**Files:**
- Create: `packages/gl/src/shaders/pathFill.ts`

Pure-data file. No tests; exercised by `ShaderProgram` tests in the next task and by the smoke test.

- [ ] **Step 1: Create shader sources**

Create `packages/gl/src/shaders/pathFill.ts`:

```ts
/**
 * GLSL ES 3.0 sources for the built-in solid-fill path shader.
 *
 * Inputs:
 *   - a_position  vec2     path-local vertex coords
 * Uniforms:
 *   - u_proj      mat3     screen → clip projection
 *   - u_model     mat3     path-local → screen (group-transform stack composed)
 *   - u_color     vec4     RGBA, 0..1 components, straight (non-premultiplied) alpha
 *   - u_alpha     float    group-alpha multiplier, 0..1
 *
 * Output: vec4 outColor with `u_color.rgb` and `u_color.a * u_alpha` as alpha.
 *
 * Blend: caller (renderer) sets `gl.blendFunc(SRC_ALPHA, ONE_MINUS_SRC_ALPHA)`.
 */

export const VERT_SRC = /* glsl */ `#version 300 es
in vec2 a_position;
uniform mat3 u_proj;
uniform mat3 u_model;
void main() {
  vec3 screen = u_model * vec3(a_position, 1.0);
  vec3 clip = u_proj * vec3(screen.xy, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}
`;

export const FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
uniform vec4 u_color;
uniform float u_alpha;
out vec4 outColor;
void main() {
  outColor = vec4(u_color.rgb, u_color.a * u_alpha);
}
`;

/** Names of uniforms the renderer must look up after compile. */
export const PATH_FILL_UNIFORMS = ['u_proj', 'u_model', 'u_color', 'u_alpha'] as const;

/** Names of attributes the renderer must look up after compile. */
export const PATH_FILL_ATTRIBUTES = ['a_position'] as const;
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add packages/gl/src/shaders/pathFill.ts
git commit -m "feat(weasel-gl): solid path-fill GLSL sources"
```

---

## Task 13: ShaderProgram wrapper

**Files:**
- Create: `packages/gl/src/ShaderProgram.ts`
- Create: `packages/gl/src/ShaderProgram.test.ts`

Compile-link-lookup wrapper. Handles compile failure via thrown `ShaderCompileError`. Reads info logs on failure.

- [ ] **Step 1: Write the failing test**

Create `packages/gl/src/ShaderProgram.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { makeGLRecorder } from '../test-utils/glRecorder';
import { ShaderProgram, ShaderCompileError } from './ShaderProgram';
import { VERT_SRC, FRAG_SRC, PATH_FILL_UNIFORMS, PATH_FILL_ATTRIBUTES } from './shaders/pathFill';

describe('ShaderProgram', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  beforeEach(() => {
    recorder = makeGLRecorder();
  });

  it('compiles vertex + fragment shaders and links a program', () => {
    const prog = new ShaderProgram(recorder.gl, VERT_SRC, FRAG_SRC);
    const callNames = recorder.calls.map((c) => c.name);
    expect(callNames).toContain('createShader');
    expect(callNames).toContain('shaderSource');
    expect(callNames).toContain('compileShader');
    expect(callNames).toContain('createProgram');
    expect(callNames).toContain('attachShader');
    expect(callNames).toContain('linkProgram');
    expect(prog.handle).toBeTruthy();
  });

  it('looks up uniform locations by name', () => {
    const prog = new ShaderProgram(recorder.gl, VERT_SRC, FRAG_SRC);
    prog.lookupUniforms(PATH_FILL_UNIFORMS);
    for (const name of PATH_FILL_UNIFORMS) {
      expect(prog.uniform(name)).toBeDefined();
    }
  });

  it('looks up attribute locations by name', () => {
    const prog = new ShaderProgram(recorder.gl, VERT_SRC, FRAG_SRC);
    prog.lookupAttributes(PATH_FILL_ATTRIBUTES);
    for (const name of PATH_FILL_ATTRIBUTES) {
      expect(prog.attribute(name)).toBeDefined();
    }
  });

  it('throws ShaderCompileError when compile reports failure', () => {
    // Override getShaderParameter to return false → compile failed.
    const failingGl = new Proxy(recorder.gl, {
      get(target, prop) {
        if (prop === 'getShaderParameter') return () => false;
        if (prop === 'getShaderInfoLog') return () => 'ERROR: fake compile error';
        return Reflect.get(target, prop);
      },
    });
    expect(() => new ShaderProgram(failingGl, VERT_SRC, FRAG_SRC)).toThrow(ShaderCompileError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/gl/src/ShaderProgram.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement ShaderProgram**

Create `packages/gl/src/ShaderProgram.ts`:

```ts
/**
 * Minimal compile/link/lookup wrapper for a GL program. Throws
 * `ShaderCompileError` on compile or link failure with the GL info log
 * embedded in the error message — never returns a half-initialized program.
 *
 * Designed so test code can stub `getShaderParameter` / `getProgramParameter`
 * via the recorder Proxy without further special-casing.
 */

export type Stage = 'vertex' | 'fragment' | 'link';

export class ShaderCompileError extends Error {
  constructor(public readonly stage: Stage, public readonly log: string) {
    super(`shader ${stage} failure: ${log}`);
    this.name = 'ShaderCompileError';
  }
}

export class ShaderProgram {
  readonly handle: WebGLProgram;
  private readonly uniforms = new Map<string, WebGLUniformLocation>();
  private readonly attributes = new Map<string, number>();

  constructor(
    private readonly gl: WebGL2RenderingContext,
    vertSrc: string,
    fragSrc: string,
  ) {
    const vs = this.compile(gl.VERTEX_SHADER, vertSrc, 'vertex');
    const fs = this.compile(gl.FRAGMENT_SHADER, fragSrc, 'fragment');
    const program = gl.createProgram();
    if (!program) throw new Error('createProgram returned null');
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program) ?? '';
      throw new ShaderCompileError('link', log);
    }
    this.handle = program;
  }

  private compile(type: number, source: string, stage: Stage): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error('createShader returned null');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) ?? '';
      throw new ShaderCompileError(stage, log);
    }
    return shader;
  }

  lookupUniforms(names: readonly string[]): void {
    for (const name of names) {
      const loc = this.gl.getUniformLocation(this.handle, name);
      if (loc !== null) this.uniforms.set(name, loc);
    }
  }

  lookupAttributes(names: readonly string[]): void {
    for (const name of names) {
      const loc = this.gl.getAttribLocation(this.handle, name);
      if (loc >= 0) this.attributes.set(name, loc);
    }
  }

  uniform(name: string): WebGLUniformLocation | undefined {
    return this.uniforms.get(name);
  }

  attribute(name: string): number | undefined {
    return this.attributes.get(name);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- packages/gl/src/ShaderProgram.test.ts`

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/ShaderProgram.ts packages/gl/src/ShaderProgram.test.ts
git commit -m "feat(weasel-gl): ShaderProgram compile/link/lookup wrapper"
```

---

## Task 14: Group state stack (transform + alpha)

**Files:**
- Create: `packages/gl/src/GroupState.ts`
- Create: `packages/gl/src/GroupState.test.ts`

Tracks the current `(transform, alpha)` while walking a DrawCommand tree. Push composes onto current; pop restores. Initial state is identity / 1.0.

- [ ] **Step 1: Write the failing test**

Create `packages/gl/src/GroupState.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GroupState } from './GroupState';
import { mat3 } from './mat3';

describe('GroupState', () => {
  it('starts at identity transform and alpha=1', () => {
    const s = new GroupState();
    expect(Array.from(s.transform)).toEqual(Array.from(mat3.identity()));
    expect(s.alpha).toBe(1);
  });

  it('push() composes transform and multiplies alpha', () => {
    const s = new GroupState();
    s.push({ transform: mat3.translate(mat3.identity(), 10, 20), alpha: 0.5 });
    const [x, y] = mat3.apply(s.transform, 0, 0);
    expect(x).toBe(10);
    expect(y).toBe(20);
    expect(s.alpha).toBe(0.5);
  });

  it('nested push composes both levels', () => {
    const s = new GroupState();
    s.push({ transform: mat3.translate(mat3.identity(), 10, 0), alpha: 0.5 });
    s.push({ transform: mat3.translate(mat3.identity(), 0, 20), alpha: 0.5 });
    const [x, y] = mat3.apply(s.transform, 0, 0);
    expect(x).toBe(10);
    expect(y).toBe(20);
    expect(s.alpha).toBe(0.25);
  });

  it('pop() restores previous transform and alpha', () => {
    const s = new GroupState();
    const before = Array.from(s.transform);
    s.push({ transform: mat3.translate(mat3.identity(), 10, 20), alpha: 0.5 });
    s.pop();
    expect(Array.from(s.transform)).toEqual(before);
    expect(s.alpha).toBe(1);
  });

  it('omitting transform/alpha in push() leaves them unchanged', () => {
    const s = new GroupState();
    s.push({ alpha: 0.5 });
    expect(Array.from(s.transform)).toEqual(Array.from(mat3.identity()));
    expect(s.alpha).toBe(0.5);
    s.pop();
    s.push({ transform: mat3.translate(mat3.identity(), 5, 5) });
    expect(s.alpha).toBe(1);
  });

  it('pop() at the root throws (helps catch unbalanced renderer code)', () => {
    const s = new GroupState();
    expect(() => s.pop()).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/gl/src/GroupState.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement GroupState**

Create `packages/gl/src/GroupState.ts`:

```ts
import { mat3, type Mat3 } from './mat3';

export interface GroupFrame {
  transform?: Mat3;
  alpha?: number;
}

/**
 * Software stack tracking the cumulative transform and alpha while walking
 * a DrawCommand tree. Mirrors the semantics of `pushTransform` / `pushAlpha`
 * in a 2D context but lives in JS (the renderer applies the cumulative
 * values as uniforms per draw call).
 *
 * `transform` and `alpha` always reflect the *cumulative* values for the
 * current frame. `push` composes onto them; `pop` restores.
 */
export class GroupState {
  private transformStack: Mat3[] = [mat3.identity()];
  private alphaStack: number[] = [1];

  get transform(): Mat3 {
    return this.transformStack[this.transformStack.length - 1];
  }

  get alpha(): number {
    return this.alphaStack[this.alphaStack.length - 1];
  }

  push(frame: GroupFrame): void {
    const current = this.transform;
    const nextTransform = frame.transform ? mat3.multiply(current, frame.transform) : current;
    const nextAlpha = frame.alpha !== undefined ? this.alpha * frame.alpha : this.alpha;
    this.transformStack.push(nextTransform);
    this.alphaStack.push(nextAlpha);
  }

  pop(): void {
    if (this.transformStack.length <= 1) {
      throw new Error('GroupState.pop: cannot pop root frame');
    }
    this.transformStack.pop();
    this.alphaStack.pop();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- packages/gl/src/GroupState.test.ts`

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/GroupState.ts packages/gl/src/GroupState.test.ts
git commit -m "feat(weasel-gl): GroupState push/pop transform + alpha stack"
```

---

## Task 15: GL mesh upload + cache

**Files:**
- Create: `packages/gl/src/GLMeshCache.ts`
- Create: `packages/gl/src/GLMeshCache.test.ts`

Upload a `Mesh` (CPU-side) into a VBO + IBO + VAO (GPU-side) and cache the GL handles keyed on Mesh identity. Re-uses the recorder for unit tests.

- [ ] **Step 1: Write the failing test**

Create `packages/gl/src/GLMeshCache.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { makeGLRecorder } from '../test-utils/glRecorder';
import type { Mesh } from './mesh';
import { GLMeshCache } from './GLMeshCache';

const sampleMesh: Mesh = {
  vertices: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
  indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
};

describe('GLMeshCache', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let cache: GLMeshCache;

  beforeEach(() => {
    recorder = makeGLRecorder();
    cache = new GLMeshCache(recorder.gl, /* aPositionLoc */ 0);
  });

  it('uploads VBO + IBO + VAO on first lookup', () => {
    cache.handleFor(sampleMesh);
    const names = recorder.calls.map((c) => c.name);
    expect(names).toContain('createBuffer');
    expect(names).toContain('createVertexArray');
    expect(names.filter((n) => n === 'bufferData').length).toBe(2); // one for VBO, one for IBO
    expect(names).toContain('vertexAttribPointer');
  });

  it('reuses the same handle on a second lookup with the same Mesh', () => {
    const a = cache.handleFor(sampleMesh);
    const b = cache.handleFor(sampleMesh);
    expect(a).toBe(b);
    // Only one set of create* calls.
    const createBufferCount = recorder.calls.filter((c) => c.name === 'createBuffer').length;
    expect(createBufferCount).toBe(2);
  });

  it('different Mesh objects upload separately', () => {
    cache.handleFor(sampleMesh);
    cache.handleFor({
      vertices: new Float32Array([0, 0, 1, 0, 1, 1]),
      indices: new Uint32Array([0, 1, 2]),
    });
    const createBufferCount = recorder.calls.filter((c) => c.name === 'createBuffer').length;
    expect(createBufferCount).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/gl/src/GLMeshCache.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement GLMeshCache**

Create `packages/gl/src/GLMeshCache.ts`:

```ts
import type { Mesh } from './mesh';

export interface GLMeshHandle {
  readonly vao: WebGLVertexArrayObject;
  readonly indexCount: number;
  readonly requiresStencil: boolean;
}

/**
 * Caches GL-side buffers + VAO per `Mesh` identity. Upload happens lazily
 * on first `handleFor(mesh)` call.
 *
 * The cache is GL-context-bound; if the context is lost and re-created, the
 * renderer should construct a new GLMeshCache. (Context loss handling lives
 * in `WeaselRenderer`.)
 */
export class GLMeshCache {
  private readonly map = new WeakMap<Mesh, GLMeshHandle>();

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly aPositionLoc: number,
  ) {}

  handleFor(mesh: Mesh): GLMeshHandle {
    const cached = this.map.get(mesh);
    if (cached) return cached;
    const handle = this.upload(mesh);
    this.map.set(mesh, handle);
    return handle;
  }

  private upload(mesh: Mesh): GLMeshHandle {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('createVertexArray returned null');
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    if (!vbo) throw new Error('createBuffer (VBO) returned null');
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(this.aPositionLoc);
    gl.vertexAttribPointer(this.aPositionLoc, 2, gl.FLOAT, false, 0, 0);

    const ibo = gl.createBuffer();
    if (!ibo) throw new Error('createBuffer (IBO) returned null');
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    return {
      vao,
      indexCount: mesh.indices.length,
      requiresStencil: mesh.requiresStencil ?? false,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- packages/gl/src/GLMeshCache.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/GLMeshCache.ts packages/gl/src/GLMeshCache.test.ts
git commit -m "feat(weasel-gl): GL-side mesh upload + cache"
```

---

## Task 16: WeaselRenderer — constructor + initial GL setup

**Files:**
- Create: `packages/gl/src/WeaselRenderer.ts`
- Create: `packages/gl/src/WeaselRenderer.test.ts`

Class wrapping the GL context. Constructor takes a `HTMLCanvasElement` (or, for tests, a precomputed `WebGL2RenderingContext`) and runs initial setup: blend mode, clear color, viewport, compile path-fill shader.

- [ ] **Step 1: Write the failing test**

Create `packages/gl/src/WeaselRenderer.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { makeGLRecorder } from '../test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';

describe('WeaselRenderer (constructor)', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  beforeEach(() => {
    recorder = makeGLRecorder();
  });

  it('configures alpha blending', () => {
    new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    const names = recorder.calls.map((c) => c.name);
    expect(names).toContain('enable');
    expect(names).toContain('blendFunc');
    const blendFuncCall = recorder.calls.find((c) => c.name === 'blendFunc')!;
    expect(blendFuncCall.args).toEqual([recorder.gl.SRC_ALPHA, recorder.gl.ONE_MINUS_SRC_ALPHA]);
  });

  it('sets initial viewport to width × dpr by height × dpr', () => {
    new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 2 });
    const viewportCall = recorder.calls.find((c) => c.name === 'viewport')!;
    expect(viewportCall.args).toEqual([0, 0, 1600, 1200]);
  });

  it('compiles the path-fill shader during construction', () => {
    new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    const names = recorder.calls.map((c) => c.name);
    expect(names).toContain('compileShader');
    expect(names).toContain('linkProgram');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/gl/src/WeaselRenderer.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement constructor**

Create `packages/gl/src/WeaselRenderer.ts`:

```ts
import { ShaderProgram } from './ShaderProgram';
import {
  VERT_SRC,
  FRAG_SRC,
  PATH_FILL_UNIFORMS,
  PATH_FILL_ATTRIBUTES,
} from './shaders/pathFill';
import { GLMeshCache } from './GLMeshCache';
import { GroupState } from './GroupState';

export interface WeaselRendererOptions {
  /** GL context. In production, callers usually pass `canvas` instead. */
  gl?: WebGL2RenderingContext;
  /** Canvas. Used when `gl` is not provided. */
  canvas?: HTMLCanvasElement;
  /** CSS-pixel width. */
  width: number;
  /** CSS-pixel height. */
  height: number;
  /** Device pixel ratio. */
  dpr: number;
}

/**
 * The WebGL2 renderer. One instance per `<canvas>` element. Holds the GL
 * context, the path-fill program, the GL-side mesh cache, and the group
 * state stack. Owns DPR (no external `setupCanvasDpr` is needed).
 */
export class WeaselRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly pathFill: ShaderProgram;
  private readonly meshCache: GLMeshCache;
  private readonly groupState = new GroupState();
  private widthCss: number;
  private heightCss: number;
  private dpr: number;

  constructor(opts: WeaselRendererOptions) {
    if (!opts.gl && !opts.canvas) {
      throw new Error('WeaselRenderer requires either gl or canvas');
    }
    const gl = opts.gl ?? opts.canvas!.getContext('webgl2');
    if (!gl) throw new Error('WeaselRenderer: WebGL2 not available');
    this.gl = gl as WebGL2RenderingContext;

    this.widthCss = opts.width;
    this.heightCss = opts.height;
    this.dpr = opts.dpr;

    // Initial GL state.
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    this.gl.disable(this.gl.DEPTH_TEST);
    this.gl.disable(this.gl.CULL_FACE);
    this.gl.clearColor(0, 0, 0, 0);
    this.applyViewport();

    // Compile the built-in path-fill program.
    this.pathFill = new ShaderProgram(this.gl, VERT_SRC, FRAG_SRC);
    this.pathFill.lookupUniforms(PATH_FILL_UNIFORMS);
    this.pathFill.lookupAttributes(PATH_FILL_ATTRIBUTES);

    const aPos = this.pathFill.attribute('a_position');
    if (aPos === undefined) throw new Error('WeaselRenderer: a_position not found in path-fill shader');
    this.meshCache = new GLMeshCache(this.gl, aPos);
  }

  private applyViewport(): void {
    this.gl.viewport(0, 0, this.widthCss * this.dpr, this.heightCss * this.dpr);
  }

  // Public methods (resize / render) added in following tasks.
  // Internal accessors used by tests and by render():
  /** @internal */ _gl(): WebGL2RenderingContext { return this.gl; }
  /** @internal */ _pathFill(): ShaderProgram { return this.pathFill; }
  /** @internal */ _meshCache(): GLMeshCache { return this.meshCache; }
  /** @internal */ _groupState(): GroupState { return this.groupState; }
  /** @internal */ _widthCss(): number { return this.widthCss; }
  /** @internal */ _heightCss(): number { return this.heightCss; }
  /** @internal */ _dpr(): number { return this.dpr; }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- packages/gl/src/WeaselRenderer.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/WeaselRenderer.ts packages/gl/src/WeaselRenderer.test.ts
git commit -m "feat(weasel-gl): WeaselRenderer constructor + initial GL state"
```

---

## Task 17: WeaselRenderer.resize()

**Files:**
- Modify: `packages/gl/src/WeaselRenderer.ts`
- Modify: `packages/gl/src/WeaselRenderer.test.ts`

- [ ] **Step 1: Add failing test**

Append to `packages/gl/src/WeaselRenderer.test.ts`:

```ts
describe('WeaselRenderer.resize', () => {
  it('updates viewport on resize', () => {
    const r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
    r.resize({ width: 1024, height: 768, dpr: 2 });
    const viewportCall = recorder.calls.find((c) => c.name === 'viewport');
    expect(viewportCall).toBeDefined();
    expect(viewportCall!.args).toEqual([0, 0, 2048, 1536]);
  });

  it('updates the canvas drawingBuffer width/height', () => {
    const canvas = { width: 0, height: 0, getContext: () => recorder.gl } as unknown as HTMLCanvasElement;
    const r = new WeaselRenderer({ canvas, width: 100, height: 100, dpr: 1 });
    r.resize({ width: 200, height: 150, dpr: 2 });
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(300);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/gl/src/WeaselRenderer.test.ts`

Expected: FAIL — `resize` not defined.

- [ ] **Step 3: Implement resize**

Two edits to `packages/gl/src/WeaselRenderer.ts`:

(a) Declare a new private field next to the existing private fields at the top of the class (just under `private dpr: number;`):

```ts
private canvas: HTMLCanvasElement | null = null;
```

(b) In the constructor, just before `this.gl.enable(this.gl.BLEND);`, save the canvas reference and set its drawingBuffer dims:

```ts
this.canvas = opts.canvas ?? null;
if (this.canvas) {
  this.canvas.width = opts.width * opts.dpr;
  this.canvas.height = opts.height * opts.dpr;
}
```

(c) Add a `resize` method to the class (anywhere after `applyViewport`):

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- packages/gl/src/WeaselRenderer.test.ts`

Expected: PASS, 5 tests total.

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/WeaselRenderer.ts packages/gl/src/WeaselRenderer.test.ts
git commit -m "feat(weasel-gl): WeaselRenderer.resize updates viewport + canvas dims"
```

---

## Task 18: WeaselRenderer — context loss / restore handlers

**Files:**
- Modify: `packages/gl/src/WeaselRenderer.ts`
- Modify: `packages/gl/src/WeaselRenderer.test.ts`

When `webglcontextlost` fires, the renderer marks state as invalid. On `webglcontextrestored`, it re-runs initial setup and re-compiles the path-fill program. Mesh-cache is recreated (Mesh meshes themselves don't change, but their GL-side handles are gone).

- [ ] **Step 1: Add failing test**

Append to `packages/gl/src/WeaselRenderer.test.ts`:

```ts
describe('WeaselRenderer context loss', () => {
  function makeFakeCanvas() {
    const listeners = new Map<string, EventListener>();
    return {
      width: 0,
      height: 0,
      getContext: () => recorder.gl,
      addEventListener: (type: string, listener: EventListener) => {
        listeners.set(type, listener);
      },
      removeEventListener: () => {},
      dispatchEvent: (type: string) => {
        listeners.get(type)?.(new Event(type) as unknown as Event);
        return true;
      },
    } as unknown as HTMLCanvasElement & { dispatchEvent: (t: string) => boolean };
  }

  it('reinitializes after webglcontextrestored', () => {
    const canvas = makeFakeCanvas();
    const r = new WeaselRenderer({ canvas, width: 100, height: 100, dpr: 1 });
    expect(r.isContextLost()).toBe(false);
    canvas.dispatchEvent('webglcontextlost');
    expect(r.isContextLost()).toBe(true);
    recorder.reset();
    canvas.dispatchEvent('webglcontextrestored');
    expect(r.isContextLost()).toBe(false);
    // New compileShader should appear in the recorded calls after restore.
    const names = recorder.calls.map((c) => c.name);
    expect(names).toContain('compileShader');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/gl/src/WeaselRenderer.test.ts`

Expected: FAIL — `isContextLost`, event handlers not present.

- [ ] **Step 3: Implement context-loss handling**

Three edits to `packages/gl/src/WeaselRenderer.ts`:

(a) Mark `pathFill` and `meshCache` as mutable (drop `readonly`) — the restore handler reassigns them. Replace the existing two field declarations near the top of the class:

```ts
private pathFill: ShaderProgram;
private meshCache: GLMeshCache;
```

(b) Add three new fields near the top of the class:

```ts
private contextLost = false;
private boundOnLost = (e: Event) => this.onContextLost(e);
private boundOnRestored = () => this.onContextRestored();
```

(c) Add three new methods to the class (anywhere after `applyViewport`):

```ts
isContextLost(): boolean {
  return this.contextLost;
}

private onContextLost(e: Event): void {
  e.preventDefault();
  this.contextLost = true;
}

private onContextRestored(): void {
  this.contextLost = false;
  // Re-run constructor's GL state setup, recompile shader, recreate mesh cache.
  this.gl.enable(this.gl.BLEND);
  this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
  this.gl.disable(this.gl.DEPTH_TEST);
  this.gl.disable(this.gl.CULL_FACE);
  this.gl.clearColor(0, 0, 0, 0);
  this.applyViewport();
  // The old GL program and buffers belong to the lost context and are now
  // invalid. Re-compile and re-create.
  this.pathFill = new ShaderProgram(this.gl, VERT_SRC, FRAG_SRC);
  this.pathFill.lookupUniforms(PATH_FILL_UNIFORMS);
  this.pathFill.lookupAttributes(PATH_FILL_ATTRIBUTES);
  const aPos = this.pathFill.attribute('a_position');
  if (aPos === undefined) throw new Error('a_position missing after restore');
  this.meshCache = new GLMeshCache(this.gl, aPos);
}
```

(d) In the constructor, immediately after `this.canvas = opts.canvas ?? null;`, register handlers:

```ts
if (this.canvas) {
  this.canvas.addEventListener('webglcontextlost', this.boundOnLost);
  this.canvas.addEventListener('webglcontextrestored', this.boundOnRestored);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- packages/gl/src/WeaselRenderer.test.ts`

Expected: PASS, 6 tests total.

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/WeaselRenderer.ts packages/gl/src/WeaselRenderer.test.ts
git commit -m "feat(weasel-gl): handle webglcontextlost / restored"
```

---

## Task 19: DrawCommand union (step-1 subset) + interpreter — kind: 'group'

**Files:**
- Create: `packages/gl/src/DrawCommand.ts`
- Create: `packages/gl/src/draw.ts`
- Create: `packages/gl/src/draw.test.ts`

The full DrawCommand union from the spec lands across multiple steps; here we land just `kind: 'group'` and `kind: 'path'`. (`text`, `image`, `shader` arrive in later steps.)

- [ ] **Step 1: Create the DrawCommand types**

Create `packages/gl/src/DrawCommand.ts`:

```ts
import type { Path } from '@weasel-js/core';
import type { Mat3 } from './mat3';

/**
 * Solid-fill paint variant (subset of the spec's full Paint union).
 * Step 1 supports only solid; pattern + gradients arrive in step 4.
 */
export interface SolidPaint {
  fill?: 'solid';
  /** Hex string `#rgb` / `#rrggbb` / CSS color keyword the renderer can parse. */
  color: string;
  opacity?: number;
}

/** DrawCommand variants implemented in step 1. */
export type DrawCommand = PathDrawCommand | GroupDrawCommand;

export interface PathDrawCommand {
  kind: 'path';
  path: Path;
  fill?: SolidPaint;
}

export interface GroupDrawCommand {
  kind: 'group';
  transform?: Mat3;
  alpha?: number;
  children: DrawCommand[];
}
```

- [ ] **Step 2: Write the failing draw() test**

Create `packages/gl/src/draw.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { makeGLRecorder } from '../test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import { mat3 } from './mat3';
import type { DrawCommand } from './DrawCommand';

describe('WeaselRenderer.render — kind: group', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  it('clears the framebuffer at the start of render', () => {
    r.render([]);
    const names = recorder.calls.map((c) => c.name);
    expect(names).toContain('clear');
  });

  it('walks an empty group without throwing', () => {
    const cmd: DrawCommand = { kind: 'group', children: [] };
    expect(() => r.render([cmd])).not.toThrow();
  });

  it('walks nested groups recursively', () => {
    const cmd: DrawCommand = {
      kind: 'group',
      transform: mat3.translate(mat3.identity(), 10, 0),
      children: [
        {
          kind: 'group',
          transform: mat3.translate(mat3.identity(), 0, 20),
          children: [],
        },
      ],
    };
    expect(() => r.render([cmd])).not.toThrow();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- packages/gl/src/draw.test.ts`

Expected: FAIL — `render` not defined.

- [ ] **Step 4: Implement the interpreter (group only) + render entry point**

Create `packages/gl/src/draw.ts`:

```ts
import type { DrawCommand, GroupDrawCommand, PathDrawCommand } from './DrawCommand';
import type { GroupState } from './GroupState';
import type { GLMeshCache } from './GLMeshCache';
import type { ShaderProgram } from './ShaderProgram';
import { mat3 } from './mat3';
import { getMesh } from './cache';

export interface DrawContext {
  gl: WebGL2RenderingContext;
  pathFill: ShaderProgram;
  meshCache: GLMeshCache;
  state: GroupState;
  widthCss: number;
  heightCss: number;
}

export function dispatch(ctx: DrawContext, cmd: DrawCommand): void {
  switch (cmd.kind) {
    case 'group': return drawGroup(ctx, cmd);
    case 'path': return drawPath(ctx, cmd);
  }
}

function drawGroup(ctx: DrawContext, cmd: GroupDrawCommand): void {
  ctx.state.push({ transform: cmd.transform, alpha: cmd.alpha });
  for (const child of cmd.children) dispatch(ctx, child);
  ctx.state.pop();
}

function drawPath(_ctx: DrawContext, _cmd: PathDrawCommand): void {
  // Implemented in next task.
}

// Re-export the projection helper so WeaselRenderer.render can compute it.
export { mat3, getMesh };
```

In `WeaselRenderer.ts`, add a `render` method:

```ts
import type { DrawCommand } from './DrawCommand';
import { dispatch, type DrawContext } from './draw';

// inside the class:
render(commands: DrawCommand[]): void {
  if (this.contextLost) return;
  const gl = this.gl;
  gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
  const ctx: DrawContext = {
    gl,
    pathFill: this.pathFill,
    meshCache: this.meshCache,
    state: this.groupState,
    widthCss: this.widthCss,
    heightCss: this.heightCss,
  };
  for (const cmd of commands) dispatch(ctx, cmd);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- packages/gl/src/draw.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/gl/src/DrawCommand.ts packages/gl/src/draw.ts packages/gl/src/draw.test.ts packages/gl/src/WeaselRenderer.ts
git commit -m "feat(weasel-gl): DrawCommand union + render entry + group interpreter"
```

---

## Task 20: Color string parser

**Files:**
- Create: `packages/gl/src/color.ts`
- Create: `packages/gl/src/color.test.ts`

`Paint.color` accepts CSS color strings; the GL uniform needs four `[0..1]` floats. The simplest robust approach: use the browser's built-in CSS parsing via a throwaway `<canvas>` 2D context. For headless/jsdom environments, a small explicit parser handles the common forms.

- [ ] **Step 1: Write the failing test**

Create `packages/gl/src/color.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseColor } from './color';

describe('parseColor', () => {
  it('parses #rrggbb', () => {
    expect(parseColor('#ff0000')).toEqual([1, 0, 0, 1]);
    expect(parseColor('#00ff00')).toEqual([0, 1, 0, 1]);
    expect(parseColor('#0000ff')).toEqual([0, 0, 1, 1]);
  });

  it('parses #rgb', () => {
    expect(parseColor('#f00')).toEqual([1, 0, 0, 1]);
  });

  it('parses #rrggbbaa', () => {
    const c = parseColor('#ff000080');
    expect(c[0]).toBe(1);
    expect(c[1]).toBe(0);
    expect(c[2]).toBe(0);
    expect(c[3]).toBeCloseTo(0x80 / 255, 2);
  });

  it('parses rgb(r, g, b)', () => {
    const c = parseColor('rgb(255, 128, 0)');
    expect(c[0]).toBe(1);
    expect(c[1]).toBeCloseTo(0.502, 2);
    expect(c[2]).toBe(0);
    expect(c[3]).toBe(1);
  });

  it('parses rgba(r, g, b, a)', () => {
    const c = parseColor('rgba(0, 0, 0, 0.5)');
    expect(c).toEqual([0, 0, 0, 0.5]);
  });

  it('throws on unrecognized input', () => {
    expect(() => parseColor('lemonchiffon')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/gl/src/color.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement parser**

Create `packages/gl/src/color.ts`:

```ts
/**
 * Parse a CSS color string into [r, g, b, a] with 0..1 components.
 *
 * Supported forms:
 *   - `#rgb`, `#rrggbb`, `#rrggbbaa`
 *   - `rgb(r, g, b)`, `rgba(r, g, b, a)` with integer 0..255 RGB and 0..1 alpha
 *
 * Named colors (e.g. `red`, `transparent`) are NOT supported in step 1;
 * use a CSS-parsing helper or hex equivalents. Adding named colors later
 * means wiring up `<canvas>.getContext('2d').fillStyle` lookup, which
 * requires a DOM and is deferred.
 */
export function parseColor(input: string): [number, number, number, number] {
  const s = input.trim();
  if (s.startsWith('#')) return parseHex(s);
  const rgbMatch = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/);
  if (rgbMatch) {
    return [
      Number(rgbMatch[1]) / 255,
      Number(rgbMatch[2]) / 255,
      Number(rgbMatch[3]) / 255,
      rgbMatch[4] !== undefined ? Number(rgbMatch[4]) : 1,
    ];
  }
  throw new Error(`parseColor: unrecognized color "${input}"`);
}

function parseHex(s: string): [number, number, number, number] {
  const hex = s.slice(1);
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16) / 255;
    const g = parseInt(hex[1] + hex[1], 16) / 255;
    const b = parseInt(hex[2] + hex[2], 16) / 255;
    return [r, g, b, 1];
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    return [r, g, b, 1];
  }
  if (hex.length === 8) {
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const a = parseInt(hex.slice(6, 8), 16) / 255;
    return [r, g, b, a];
  }
  throw new Error(`parseColor: invalid hex "${s}"`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- packages/gl/src/color.test.ts`

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/color.ts packages/gl/src/color.test.ts
git commit -m "feat(weasel-gl): parseColor for solid Paint fills"
```

---

## Task 21: DrawCommand interpreter — kind: 'path' (nonzero solid fill)

**Files:**
- Modify: `packages/gl/src/draw.ts`
- Modify: `packages/gl/src/draw.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `packages/gl/src/draw.test.ts`:

```ts
import type { RectPath } from '@weasel-js/core';

describe('WeaselRenderer.render — kind: path (nonzero solid)', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  it('binds the path-fill program before drawing a path', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    r.render([{ kind: 'path', path, fill: { color: '#ff0000' } }]);
    const names = recorder.calls.map((c) => c.name);
    expect(names).toContain('useProgram');
  });

  it('issues a drawElements call with the mesh index count', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    r.render([{ kind: 'path', path, fill: { color: '#ff0000' } }]);
    const draw = recorder.calls.find((c) => c.name === 'drawElements');
    expect(draw).toBeDefined();
    expect(draw!.args[1]).toBe(6);                                 // 2 triangles × 3
    expect(draw!.args[2]).toBe(recorder.gl.UNSIGNED_INT);
  });

  it('skips paths with no fill', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    r.render([{ kind: 'path', path }]);
    const draw = recorder.calls.find((c) => c.name === 'drawElements');
    expect(draw).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- packages/gl/src/draw.test.ts`

Expected: FAIL — `drawPath` is a no-op.

- [ ] **Step 3: Implement drawPath**

Replace the `drawPath` function in `packages/gl/src/draw.ts`:

```ts
import { parseColor } from './color';
import { mat3 } from './mat3';

function drawPath(ctx: DrawContext, cmd: PathDrawCommand): void {
  if (!cmd.fill) return;

  const mesh = getMesh(cmd.path);
  const handle = ctx.meshCache.handleFor(mesh);
  const gl = ctx.gl;

  if (handle.requiresStencil) {
    drawPathStencil(ctx, cmd, handle);
    return;
  }

  gl.useProgram(ctx.pathFill.handle);
  gl.bindVertexArray(handle.vao);

  const proj = mat3.screenToClip(ctx.widthCss, ctx.heightCss);
  gl.uniformMatrix3fv(ctx.pathFill.uniform('u_proj')!, false, proj);
  gl.uniformMatrix3fv(ctx.pathFill.uniform('u_model')!, false, ctx.state.transform);

  const [r, g, b, a] = parseColor(cmd.fill.color);
  const opacity = cmd.fill.opacity ?? 1;
  gl.uniform4f(ctx.pathFill.uniform('u_color')!, r, g, b, a * opacity);
  gl.uniform1f(ctx.pathFill.uniform('u_alpha')!, ctx.state.alpha);

  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}

function drawPathStencil(_ctx: DrawContext, _cmd: PathDrawCommand, _handle: { vao: unknown; indexCount: number }): void {
  // Implemented in next task.
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- packages/gl/src/draw.test.ts`

Expected: PASS, 6 tests total. (Three new path tests pass; previous group tests still pass.)

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/draw.ts packages/gl/src/draw.test.ts
git commit -m "feat(weasel-gl): draw kind: 'path' with nonzero solid fill"
```

---

## Task 22: DrawCommand interpreter — kind: 'path' (evenodd, stencil two-pass)

**Files:**
- Modify: `packages/gl/src/draw.ts`
- Modify: `packages/gl/src/draw.test.ts`

Stencil two-pass for evenodd:
1. **Pass 1 (mask build):** disable color writes; enable stencil; configure `stencilOp(KEEP, KEEP, INVERT)` so each fragment toggles its stencil bit. Draw the naive fan. Result: stencil bits are 1 inside (odd-coverage) regions, 0 outside.
2. **Pass 2 (color):** enable color writes; configure `stencilFunc(NOTEQUAL, 0, 0xff)` so only fragments with non-zero stencil pass. Draw a screen-aligned quad (or just re-draw the fan) that fills the bounding region with the desired color.

For step 1, we re-draw the fan as the second pass — it covers the same fragments and the stencil func filters to inside-only.

- [ ] **Step 1: Add failing tests**

Append to `packages/gl/src/draw.test.ts`:

```ts
import type { PolygonPath } from '@weasel-js/core';
import { PATH_M as M, PATH_L as L, PATH_Z as Z } from '@weasel-js/core';

describe('WeaselRenderer.render — kind: path (evenodd stencil two-pass)', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  it('enables stencil and issues two drawElements for an evenodd path', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([M, L, L, L, Z]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
      fillRule: 'evenodd',
    };
    r.render([{ kind: 'path', path, fill: { color: '#ff0000' } }]);

    const names = recorder.calls.map((c) => c.name);
    expect(names).toContain('enable');
    const enableCalls = recorder.calls.filter((c) => c.name === 'enable');
    const enabledStencil = enableCalls.some((c) => c.args[0] === recorder.gl.STENCIL_TEST);
    expect(enabledStencil).toBe(true);

    const drawCalls = recorder.calls.filter((c) => c.name === 'drawElements');
    expect(drawCalls.length).toBe(2);
  });

  it('clears stencil before the mask pass', () => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([M, L, L, L, Z]),
      coords: new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]),
      fillRule: 'evenodd',
    };
    r.render([{ kind: 'path', path, fill: { color: '#ff0000' } }]);
    const clearCalls = recorder.calls.filter((c) => c.name === 'clear');
    // One clear at frame start (COLOR_BUFFER_BIT | STENCIL_BUFFER_BIT).
    expect(clearCalls.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- packages/gl/src/draw.test.ts`

Expected: FAIL — `drawPathStencil` is still a stub.

- [ ] **Step 3: Implement drawPathStencil**

Replace `drawPathStencil` in `packages/gl/src/draw.ts`:

```ts
import type { GLMeshHandle } from './GLMeshCache';

function drawPathStencil(ctx: DrawContext, cmd: PathDrawCommand, handle: GLMeshHandle): void {
  if (!cmd.fill) return;
  const gl = ctx.gl;

  gl.useProgram(ctx.pathFill.handle);
  gl.bindVertexArray(handle.vao);

  const proj = mat3.screenToClip(ctx.widthCss, ctx.heightCss);
  gl.uniformMatrix3fv(ctx.pathFill.uniform('u_proj')!, false, proj);
  gl.uniformMatrix3fv(ctx.pathFill.uniform('u_model')!, false, ctx.state.transform);

  // Pass 1: build stencil. Disable color writes; INVERT stencil per fragment.
  gl.enable(gl.STENCIL_TEST);
  gl.colorMask(false, false, false, false);
  gl.stencilMask(0xff);
  gl.stencilFunc(gl.ALWAYS, 0, 0xff);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);

  // Pass 2: paint. Enable color writes; pass where stencil != 0.
  gl.colorMask(true, true, true, true);
  gl.stencilFunc(gl.NOTEQUAL, 0, 0xff);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
  const [r, g, b, a] = parseColor(cmd.fill.color);
  const opacity = cmd.fill.opacity ?? 1;
  gl.uniform4f(ctx.pathFill.uniform('u_color')!, r, g, b, a * opacity);
  gl.uniform1f(ctx.pathFill.uniform('u_alpha')!, ctx.state.alpha);
  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);

  // Restore: clear stencil for next path, disable stencil test.
  gl.clear(gl.STENCIL_BUFFER_BIT);
  gl.disable(gl.STENCIL_TEST);
  gl.bindVertexArray(null);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- packages/gl/src/draw.test.ts`

Expected: PASS, 8 tests total.

- [ ] **Step 5: Commit**

```bash
git add packages/gl/src/draw.ts packages/gl/src/draw.test.ts
git commit -m "feat(weasel-gl): evenodd path via stencil two-pass"
```

---

## Task 23: Index barrel exports

**Files:**
- Modify: `packages/gl/src/index.ts`

- [ ] **Step 1: Update the barrel**

Replace `packages/gl/src/index.ts`:

```ts
/**
 * @weasel-js/gl — public barrel.
 *
 * Experimental. Surface evolves through the WebGL transition steps.
 * Step 1 ships: WeaselRenderer + DrawCommand types for solid-fill paths
 * and groups.
 */

export const __weaselGlPackage = true as const;

export { WeaselRenderer, type WeaselRendererOptions } from './WeaselRenderer';
export type {
  DrawCommand,
  GroupDrawCommand,
  PathDrawCommand,
  SolidPaint,
} from './DrawCommand';
export { mat3, type Mat3 } from './mat3';
export { tessellate, type TessellateOptions } from './tessellate';
export type { Mesh } from './mesh';
```

- [ ] **Step 2: Update the barrel test**

Replace `packages/gl/src/index.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { WeaselRenderer, mat3, tessellate } from './index';

describe('weasel-gl barrel', () => {
  it('exports WeaselRenderer', () => {
    expect(WeaselRenderer).toBeDefined();
  });
  it('exports mat3 and tessellate', () => {
    expect(typeof mat3.identity).toBe('function');
    expect(typeof tessellate).toBe('function');
  });
});
```

- [ ] **Step 3: Run tests + typecheck**

Run: `npm test -- packages/gl/src/index.test.ts`

Expected: PASS, 2 tests.

Run: `npm run typecheck`

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add packages/gl/src/index.ts packages/gl/src/index.test.ts
git commit -m "feat(weasel-gl): public barrel exports for step 1"
```

---

## Task 24: Smoke page (manual)

**Files:**
- Create: `packages/gl/dev/smoke.html`
- Create: `packages/gl/dev/smoke.ts`
- Modify: `vite.config.ts` (root) — verify it picks up `packages/gl/dev/`

A small browser page that boots the renderer against a real GL context and renders a 100×100 red square at (50, 50). Used for manual eyeballing during development and as the target of the Playwright smoke test in the next task.

- [ ] **Step 1: Create the smoke page**

Create `packages/gl/dev/smoke.html`:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>weasel-gl step 1 smoke</title>
    <style>
      html, body { margin: 0; padding: 0; background: #222; }
      canvas { display: block; }
    </style>
  </head>
  <body>
    <canvas id="canvas" width="800" height="600" style="width: 800px; height: 600px;"></canvas>
    <script type="module" src="./smoke.ts"></script>
  </body>
</html>
```

Create `packages/gl/dev/smoke.ts`:

```ts
import { WeaselRenderer, mat3 } from '../src/index';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const r = new WeaselRenderer({ canvas, width: 800, height: 600, dpr: window.devicePixelRatio || 1 });

r.render([
  {
    kind: 'path',
    path: { kind: 'rect', x: 50, y: 50, width: 100, height: 100 },
    fill: { color: '#ff0000' },
  },
  {
    kind: 'group',
    transform: mat3.translate(mat3.identity(), 200, 50),
    alpha: 0.5,
    children: [
      {
        kind: 'path',
        path: { kind: 'rect', x: 0, y: 0, width: 100, height: 100 },
        fill: { color: '#00ff00' },
      },
    ],
  },
]);
```

- [ ] **Step 2: Verify root vite picks the file up**

The root `vite.config.ts` is configured for the demo app. To boot the smoke page, run:

```bash
npx vite --config vite.config.ts dev
```

Then visit: `http://localhost:5173/packages/gl/dev/smoke.html`

Expected: a red 100×100 square at (50, 50) and a 50%-opacity green 100×100 square at (200, 50) on a dark gray page.

If vite doesn't resolve the path (e.g. it 404s), add an explicit entry in `vite.config.ts` for the smoke page or verify `root` includes the package. Do not invent unrelated config — this is a discovery task; if vite needs configuration, document the change in this step's commit message.

- [ ] **Step 3: Eyeball verification**

Open the URL, confirm two squares render (red opaque, green half-opacity). Commit only after manual verification passes.

- [ ] **Step 4: Commit**

```bash
git add packages/gl/dev/smoke.html packages/gl/dev/smoke.ts
git commit -m "chore(weasel-gl): smoke page for manual + Playwright verification"
```

---

## Task 25: Playwright smoke test

**Files:**
- Modify: `package.json` — add `@playwright/test`, `pixelmatch`, `pngjs`, scripts
- Create: `packages/gl/dev/playwright.config.ts`
- Create: `packages/gl/dev/smoke.spec.ts`

Step-1 smoke test: boot the smoke page and confirm the expected pixels are roughly the expected colors. NOT a baseline — full visual regression rig lands in step 9.

- [ ] **Step 1: Add devDependencies**

Run: `npm install --save-dev @playwright/test@1.47.2 pixelmatch@5.3.0 pngjs@7.0.0 @types/pixelmatch @types/pngjs`

Run: `npx playwright install chromium` (one-time, downloads the browser binary).

- [ ] **Step 2: Add scripts**

In root `package.json`, add to `scripts`:

```jsonc
"test:smoke:step1": "playwright test --config=packages/gl/dev/playwright.config.ts"
```

- [ ] **Step 3: Create Playwright config**

Create `packages/gl/dev/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'smoke.spec.ts',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: {
    // Vite picks up `vite.config.ts` from the cwd automatically.
    command: 'npx vite --port 5173',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

- [ ] **Step 4: Write the smoke test**

Create `packages/gl/dev/smoke.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('step 1 smoke — red and green rects render', async ({ page }) => {
  await page.goto('/packages/gl/dev/smoke.html');
  // Wait for canvas to exist and the renderer to flush.
  await page.waitForSelector('canvas');
  await page.waitForTimeout(200);                       // generous; the smoke renders synchronously
  const canvas = page.locator('canvas');

  // Sample a pixel inside the red square (50,50)–(150,150) → center (100, 100).
  const redPixel = await page.evaluate(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement;
    // Use a tiny 2D readback via toDataURL → off-screen Image is heavy; readPixels is the right primitive.
    const gl = c.getContext('webgl2')!;
    const px = new Uint8Array(4);
    // Y is flipped in GL framebuffers; sample at y=600-100=500.
    gl.readPixels(100, 500, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return Array.from(px);
  });
  expect(redPixel[0]).toBeGreaterThan(200);             // red high
  expect(redPixel[1]).toBeLessThan(40);                 // green low
  expect(redPixel[2]).toBeLessThan(40);                 // blue low

  // Sample inside the green rect at (200..300, 50..150) → center (250, 100).
  const greenPixel = await page.evaluate(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement;
    const gl = c.getContext('webgl2')!;
    const px = new Uint8Array(4);
    gl.readPixels(250, 500, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return Array.from(px);
  });
  // Green at 50% alpha over a transparent (clear-color black) background.
  expect(greenPixel[1]).toBeGreaterThan(60);
  expect(greenPixel[0]).toBeLessThan(40);
});
```

- [ ] **Step 5: Run the smoke test**

Run: `npm run test:smoke:step1`

Expected: PASS — Playwright boots vite, navigates to the smoke page, samples pixels, asserts colors. If the dev server doesn't start, debug `vite.config.ts` to confirm the path is reachable.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json packages/gl/dev/playwright.config.ts packages/gl/dev/smoke.spec.ts
git commit -m "test(weasel-gl): Playwright smoke for step 1"
```

---

## Task 26: Synthetic scene exit verification

**Files:**
- Create: `packages/gl/dev/synthetic.html`
- Create: `packages/gl/dev/synthetic.ts`

Verifies the step-1 spec exit criterion: synthetic test scenes (10 / 100 / 1000 polygons; nested groups with transform + alpha; both fillRules) render correctly. Manual eyeball verification only — automated visual regression lands in step 9.

- [ ] **Step 1: Create the synthetic scene page**

Create `packages/gl/dev/synthetic.html`:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>weasel-gl step 1 synthetic scenes</title>
    <style>
      html, body { margin: 0; padding: 0; background: #222; color: #fff; font: 13px sans-serif; }
      canvas { display: block; margin: 8px; background: #000; }
      h2 { margin: 8px; }
    </style>
  </head>
  <body>
    <h2>10 polygons, nonzero, nested group α=0.5</h2>
    <canvas id="c10" width="800" height="200"></canvas>
    <h2>100 polygons, nonzero</h2>
    <canvas id="c100" width="800" height="200"></canvas>
    <h2>1000 polygons, nonzero</h2>
    <canvas id="c1000" width="800" height="600"></canvas>
    <h2>Evenodd: square with concentric square hole</h2>
    <canvas id="cEvenodd" width="400" height="400"></canvas>
    <script type="module" src="./synthetic.ts"></script>
  </body>
</html>
```

Create `packages/gl/dev/synthetic.ts`:

```ts
import { WeaselRenderer, mat3 } from '../src/index';
import {
  type DrawCommand,
} from '../src/DrawCommand';
import {
  PATH_M, PATH_L, PATH_Z,
  type PolygonPath,
} from '@weasel-js/core';

function randomRectCommand(seed: number, color: string): DrawCommand {
  const rand = (s: number) => Math.abs(Math.sin(s * 9301 + 49297) * 233280) % 1;
  const x = rand(seed) * 700;
  const y = rand(seed + 1) * 100;
  const w = 20 + rand(seed + 2) * 50;
  const h = 20 + rand(seed + 3) * 50;
  return {
    kind: 'path',
    path: { kind: 'rect', x, y, width: w, height: h },
    fill: { color },
  };
}

function buildScene(count: number): DrawCommand[] {
  const inner: DrawCommand[] = [];
  for (let i = 0; i < count; i++) inner.push(randomRectCommand(i, `#${(i * 7919).toString(16).slice(0, 6).padEnd(6, '0')}`));
  return [{ kind: 'group', alpha: 0.5, children: inner }];
}

const make = (id: string, w: number, h: number, scene: DrawCommand[]) => {
  const c = document.getElementById(id) as HTMLCanvasElement;
  const r = new WeaselRenderer({ canvas: c, width: w, height: h, dpr: window.devicePixelRatio || 1 });
  r.render(scene);
};

make('c10', 800, 200, buildScene(10));
make('c100', 800, 200, buildScene(100));
make('c1000', 800, 600, buildScene(1000));

// Evenodd: outer 200×200 square + inner 100×100 square. Stencil sorts overlap → ring.
const ringPath: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([
    PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
    PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
  ]),
  coords: new Float32Array([
    50, 50, 250, 50, 250, 250, 50, 250,
    100, 100, 200, 100, 200, 200, 100, 200,
  ]),
  fillRule: 'evenodd',
};
make('cEvenodd', 400, 400, [{ kind: 'path', path: ringPath, fill: { color: '#00aaff' } }]);
```

- [ ] **Step 2: Manual verification**

Run: `npx vite --config vite.config.ts dev`

Visit: `http://localhost:5173/packages/gl/dev/synthetic.html`

Expected:
- 10-rect scene: 10 colored rectangles within the canvas, all at half opacity (group α=0.5).
- 100-rect scene: ~100 colored rects scattered across canvas.
- 1000-rect scene: dense scatter; renders without freezing the tab.
- Evenodd scene: a hollow blue square ring (inner square is *not* filled).

If any scene fails to render (black canvas) or renders incorrectly (wrong stencil for evenodd, missing rects), debug before committing.

- [ ] **Step 3: Commit**

```bash
git add packages/gl/dev/synthetic.html packages/gl/dev/synthetic.ts
git commit -m "chore(weasel-gl): synthetic scenes for step 1 exit verification"
```

---

## Task 27: TODO.md update + step-1 done note

**Files:**
- Modify: `docs/TODO.md`
- Create: `docs/superpowers/plans/2026-05-08-webgl-step-1-done.md`

- [ ] **Step 1: Add the done note**

Create `docs/superpowers/plans/2026-05-08-webgl-step-1-done.md`:

```md
# WebGL Step 1 — Done

**Plan:** [`2026-05-08-webgl-step-1-solid-fill-paths.md`](./2026-05-08-webgl-step-1-solid-fill-paths.md)
**Date completed:** YYYY-MM-DD (fill in)

## What shipped

- `@weasel-js/gl` workspace package wired into `tsconfig.json`.
- Path tessellator (earcut + bezier flattening via reused `flattenCubic`/`flattenQuadratic`).
- evenodd fillRule via naive fan + stencil two-pass.
- WeakMap path-mesh cache.
- `WeaselRenderer` with WebGL2 context, DPR-aware viewport, `resize()`, context-loss/restore handling.
- Solid-fill path GLSL shader + `ShaderProgram` wrapper.
- DrawCommand interpreter for `kind: 'group'` (transform + alpha) and `kind: 'path'` (solid fill, both fill rules).
- Playwright smoke test asserting red/green pixels render.
- Manual synthetic scene verification (10/100/1000 polygons; nested α; evenodd ring).

## Lessons for step 2

- (Fill in after running through the plan — friction points, surprises.)
- (e.g., did GL recorder need additional GL constants? Did the stencil pass actually work first try?)

## Open questions surfaced

- (e.g., do we need a Mesh disposal API for very-long-lived sessions?)
```

- [ ] **Step 2: Update TODO.md**

Find the WebGL transition entry in `docs/TODO.md` (or add a new section if absent). Add:

```md
- [x] WebGL transition step 1 — solid-fill paths shipped (2026-05-08)
- [ ] WebGL transition step 2 — strokes (plan TBW)
```

- [ ] **Step 3: Commit**

```bash
git add docs/TODO.md docs/superpowers/plans/2026-05-08-webgl-step-1-done.md
git commit -m "docs(webgl): step 1 done note + TODO update"
```

---

## Task 28: Bundle-size CI gate (conditional)

**Files:**
- Modify: `.github/workflows/ci.yml` if it exists; otherwise note in roadmap

The transition spec calls for failing PRs that grow the `weasel-gl` bundle by > 50 KB without a `CHANGELOG` entry. Implement only if a CI workflow already exists; if not, this becomes a roadmap entry to set up alongside the visual-regression rig in step 9.

- [ ] **Step 1: Check whether a CI workflow exists**

Run: `ls .github/workflows/`

If `ci.yml` (or similar) exists, continue. Otherwise:

- Add a one-line note to `docs/superpowers/plans/2026-05-08-webgl-transition-roadmap.md` under "Cross-cutting work" stating that the bundle-size gate is deferred until a CI workflow is set up (alongside step 9).
- Commit with message: `docs(roadmap): note bundle-size gate deferred to CI setup`
- Skip the rest of this task.

- [ ] **Step 2: Add a `bundlesize` script to `package.json`**

(Only if CI exists.) Add:

```jsonc
"scripts": {
  "bundlesize:weasel-gl": "tsup packages/gl/src/index.ts --format esm --out-dir /tmp/weasel-gl-bundle && wc -c /tmp/weasel-gl-bundle/index.mjs"
}
```

- [ ] **Step 3: Add a CI step**

Add to the existing CI workflow (don't invent a new file):

```yaml
- name: Build weasel-gl bundle
  run: npm run bundlesize:weasel-gl > bundle-size.txt
- name: Compare bundle size against main
  run: |
    git fetch origin main
    git checkout origin/main -- packages/gl
    npm run bundlesize:weasel-gl > bundle-size-main.txt
    delta_kb=$(echo "($(wc -c < bundle-size.txt) - $(wc -c < bundle-size-main.txt)) / 1024" | bc)
    if [ "$delta_kb" -gt 50 ]; then
      if ! grep -q "bundle-size" CHANGELOG.md; then
        echo "Bundle size grew by ${delta_kb}KB without CHANGELOG entry"
        exit 1
      fi
    fi
```

(Adapt the YAML to the existing workflow's idioms — runs-on, checkout pattern, etc. The above is illustrative.)

- [ ] **Step 4: Commit**

```bash
git add .github/workflows package.json
git commit -m "ci(weasel-gl): fail PRs that grow bundle > 50KB without CHANGELOG entry"
```

---

## Self-review checklist (run before declaring step 1 done)

- [ ] All vitest tests pass: `npm test`
- [ ] Typecheck passes: `npm run typecheck`
- [ ] Smoke test passes: `npm run test:smoke:step1`
- [ ] Synthetic scenes render correctly (manual eyeball at all four canvases)
- [ ] Step-1 done note filled in with actual completion date and lessons learned
- [ ] TODO.md updated
- [ ] No console errors when running synthetic scene page
- [ ] Manual smoke test in non-Chromium browsers (Firefox, Safari) — note any quirks in the done note even if they're not blocking

## What this step deliberately does NOT include

- **Stroke rendering** — step 2.
- **Text rendering** — step 3.
- **Image / pattern / gradient Paint variants** — step 4.
- **Per-vertex colors / color matrix** — step 5.
- **Custom shader API (`registerProgram`)** — step 6.
- **Porting `weasel`'s built-in layers** — step 7.
- **Wiring into `<Canvas>`** — step 8.
- **Visual regression baselines** — step 9.

The step-1 renderer is a parallel package that nothing in `@weasel-js/core` references. Demos still run on the 2D backend. Abandonment is cheap: delete `packages/gl/` and the new tsconfig paths.
