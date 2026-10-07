import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as Barrel from './index';
import { SHAPE_KINDS, shapeKindsWhere } from './core/shapeKinds';

const ROOT = __dirname;

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walkTs(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function findExportedNames(files: string[], pattern: RegExp): Set<string> {
  const names = new Set<string>();
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const match of src.matchAll(pattern)) {
      names.add(match[1]);
    }
  }
  return names;
}

describe('kit barrel parity', () => {
  it('re-exports every create*Op factory from src/core/ops/', () => {
    const opFiles = walkTs(join(ROOT, 'core', 'ops'));
    // `export function createFooOp(...)` or `export const createFooOp = ...`
    const factories = findExportedNames(
      opFiles,
      /^export\s+(?:function|const)\s+(create[A-Z][A-Za-z0-9_]*Op)\b/gm,
    );

    expect(factories.size).toBeGreaterThan(0);
    const missing: string[] = [];
    for (const name of factories) {
      if (typeof (Barrel as Record<string, unknown>)[name] !== 'function') {
        missing.push(name);
      }
    }
    expect(missing, `Op factories defined in src/core/ops/ but not re-exported from src/index.ts: ${missing.join(', ')}`).toEqual([]);
  });

  // The Bundle Inspector (`apps/draw/src/dev/registryData.ts`) reads the
  // kit-exported tuple rather than mirroring the union, so the barrel has to
  // keep shipping it.
  it('exports KIT_SHAPE_KINDS as derived from the shape-kind table', () => {
    const kinds = (Barrel as Record<string, unknown>).KIT_SHAPE_KINDS;
    expect(Array.isArray(kinds), 'KIT_SHAPE_KINDS must be exported as an array').toBe(true);
    // `BuiltinShapeToolId` is `keyof`-derived from the same table, so the
    // union can no longer drift from the tuple; what's left to check is that
    // the barrel ships the derivation rather than a copy of it.
    expect(kinds).toEqual(shapeKindsWhere(SHAPE_KINDS, 'tool'));
  });

  // `defaultNodeRouting` is now derived from `KIT_SHAPE_KINDS` via `.map` in the
  // same (canvas) layer, so it's in lockstep by construction — no cross-layer
  // parity test needed (the two no longer straddle a boundary).

  // Consumers list the presets from the kit's own tables rather than a copy —
  // assert the barrel ships them: one action list per base preset, one
  // expansion per composite.
  it('exports SCENE_CANVAS_FEATURES, FEATURE_ACTION_IDS and COMPOSITE_FEATURES for every preset', () => {
    const features = (Barrel as Record<string, unknown>).SCENE_CANVAS_FEATURES as
      | readonly string[]
      | undefined;
    const table = (Barrel as Record<string, unknown>).FEATURE_ACTION_IDS as
      | Record<string, readonly string[]>
      | undefined;
    const composites = (Barrel as Record<string, unknown>).COMPOSITE_FEATURES as
      | Record<string, readonly string[]>
      | undefined;
    expect(features, 'SCENE_CANVAS_FEATURES must be exported').toBeDefined();
    expect(table, 'FEATURE_ACTION_IDS must be exported').toBeDefined();
    expect(composites, 'COMPOSITE_FEATURES must be exported').toBeDefined();
    expect([...Object.keys(table!), ...Object.keys(composites!)].sort()).toEqual([...features!].sort());
  });
});

describe('scene postProcess exports', () => {
  it('SceneSlotConfig.postProcess signature is expressible with barrel types only', () => {
    // Type-level check (enforced by `tsc --noEmit`, not at runtime): the hook
    // and every type in its signature — DrawCommand, View, Dims — are
    // reachable from the public barrel, so consumers can annotate a
    // postProcess implementation without internal imports.
    type Cfg = Barrel.SceneSlotConfig<{ id: string }, unknown>;
    const hook: NonNullable<Cfg['postProcess']> = (
      cmds: Barrel.DrawCommand[],
      _view: Barrel.View,
      _dims: Barrel.Dims,
    ) => cmds;
    expect(typeof hook).toBe('function');
  });
});

describe('registry-unification exports (ActiveToolContext)', () => {
  it('exposes the ActiveToolContext value exports on the main barrel', () => {
    expect(Barrel.ActiveToolContextProvider).toBeDefined();
    expect(Barrel.useActiveToolContext).toBeDefined();
  });
});

describe('registry-unification exports (DepRegistry + dispatcher)', () => {
  it('exposes the DepRegistry and dispatcher value exports on the main barrel', () => {
    expect(Barrel.DepRegistryProvider).toBeDefined();
    expect(Barrel.useDepRegistry).toBeDefined();
    expect(Barrel.useDepSource).toBeDefined();
    expect(Barrel.useGestureDispatcher).toBeDefined();
    expect(Barrel.createDispatcher).toBeDefined();
    expect(Barrel.defaultCommitAdapter).toBeDefined();
  });
});

describe('ephemeral pose override exports', () => {
  it('PoseOverrides is expressible with barrel types only', () => {
    // Type-level check (enforced by `tsc --noEmit`): a consumer can annotate a
    // frame-loop helper against the public barrel without internal imports.
    type Pose = { x: number; y: number; width: number; height: number };
    const bump = (
      overrides: Barrel.PoseOverrides<Pose>,
      id: Barrel.NodeId,
      entry: Barrel.PoseOverride<Pose>,
    ) => {
      overrides.set(id, entry);
      overrides.commit();
    };
    expect(typeof bump).toBe('function');
  });
});

describe('camera animation barrel surface', () => {
  it('exports the camera runner and its interpolator, and no longer exports useViewTween', () => {
    const b = Barrel as Record<string, unknown>;
    expect(typeof b.useViewAnimation).toBe('function');
    expect(typeof b.interpolateView).toBe('function');
    expect(b.VIEW_ANIMATION_KEY).toBe('view');
    expect('useViewTween' in b).toBe(false);
  });
});

describe('draw command exports', () => {
  const barrelSrc = (name: string) => readFileSync(join(ROOT, name), 'utf8');

  /**
   * Every `*DrawCommand` the renderer barrel names must be nameable from the
   * main barrel too. `src/index.ts` re-exports the renderer by name rather
   * than with a star, so adding a variant there and stopping reaches only
   * consumers importing the `/renderer` subpath — which is how
   * `SpritesDrawCommand` shipped in 1.4.1 unreachable from `@weasel-js/core`.
   */
  it('names every DrawCommand variant on the main barrel', () => {
    const variantsIn = (src: string) =>
      new Set([...src.matchAll(/\b(\w+DrawCommand)\b/g)].map((m) => m[1]));
    const fromRenderer = variantsIn(barrelSrc('renderer/index.ts'));
    const fromMain = variantsIn(barrelSrc('index.ts'));
    expect(fromRenderer.size).toBeGreaterThan(4);
    expect([...fromRenderer].filter((n) => !fromMain.has(n))).toEqual([]);
  });

  it('exports the constant a consumer needs to pack a sprite run', () => {
    expect(Barrel.SPRITE_STRIDE).toBe(9);
  });
});

describe('reset seams', () => {
  it('keeps them off the package barrel', () => {
    expect(Object.keys(Barrel).filter((k) => k.endsWith('ForTests'))).toEqual([]);
  });

  it('reaches every one through the test-seams entry', async () => {
    const seams = await import('@weasel-js/core/test-seams');
    expect(Object.keys(seams).length).toBeGreaterThan(0);
    expect(Object.keys(seams).every((k) => k.endsWith('ForTests'))).toBe(true);
  });
});
