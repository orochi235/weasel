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
  // assert the barrel ships them: one action list per preset.
  it('exports SCENE_CANVAS_FEATURES and FEATURE_ACTION_IDS for every preset, and describePresets', () => {
    const features = (Barrel as Record<string, unknown>).SCENE_CANVAS_FEATURES as
      | readonly string[]
      | undefined;
    const table = (Barrel as Record<string, unknown>).FEATURE_ACTION_IDS as
      | Record<string, readonly string[]>
      | undefined;
    expect(features, 'SCENE_CANVAS_FEATURES must be exported').toBeDefined();
    expect(table, 'FEATURE_ACTION_IDS must be exported').toBeDefined();
    expect(Object.keys(table!).sort()).toEqual([...features!].sort());
    expect(Barrel.describePresets).toBeTypeOf('function');
  });
});

// Checked by the typecheck, not at runtime: a consumer can annotate a
// postProcess hook and a pose-override helper from the barrel's types alone.
type Cfg = Barrel.SceneSlotConfig<{ id: string }, unknown>;
const hook: NonNullable<Cfg['postProcess']> = (
  cmds: Barrel.DrawCommand[],
  _view: Barrel.View,
  _dims: Barrel.Dims,
) => cmds;
void hook;
type Pose = { x: number; y: number; width: number; height: number };
const bump = (
  overrides: Barrel.PoseOverrides<Pose>,
  id: Barrel.NodeId,
  entry: Barrel.PoseOverride<Pose>,
) => {
  overrides.set(id, entry);
  overrides.commit();
};
void bump;

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

describe('adapter wirings on the barrel', () => {
  // A flat item list is `useScene({ items })`, so the scene's adapter is the only wiring.
  it('ships the scene adapter and no array adapter', () => {
    const b = Barrel as Record<string, unknown>;
    expect(typeof b.sceneToAdapter).toBe('function');
    expect(typeof b.useSceneAdapter).toBe('function');
    expect(b.arrayAdapter).toBeUndefined();
    expect(b.useArrayAdapter).toBeUndefined();
  });
});

describe('camera animation barrel surface', () => {
  it('exports the camera runner and its interpolator', () => {
    const b = Barrel as Record<string, unknown>;
    expect(typeof b.useViewAnimation).toBe('function');
    expect(typeof b.interpolateView).toBe('function');
    expect(b.VIEW_ANIMATION_KEY).toBe('view');
  });
});

describe('draw command exports', () => {
  const barrelSrc = (name: string) => readFileSync(join(ROOT, name), 'utf8');

  /**
   * Every `*DrawCommand` the renderer barrel names must be nameable from the
   * main barrel too. `src/barrel/` re-exports the renderer by name rather
   * than with a star, so adding a variant there and stopping reaches only
   * consumers importing the `/renderer` subpath — which is how
   * `SpritesDrawCommand` shipped in 1.4.1 unreachable from `@weasel-js/core`.
   */
  it('names every DrawCommand variant on the main barrel', () => {
    const variantsIn = (src: string) =>
      new Set([...src.matchAll(/\b(\w+DrawCommand)\b/g)].map((m) => m[1]));
    const fromRenderer = variantsIn(barrelSrc('../../renderer/src/index.ts'));
    const fromMain = variantsIn(readdirSync(join(ROOT, 'barrel')).map((f) => barrelSrc(`barrel/${f}`)).join('\n'));
    expect(fromRenderer.size).toBeGreaterThan(4);
    expect([...fromRenderer].filter((n) => !fromMain.has(n))).toEqual([]);
  });

  it('exports the constant a consumer needs to pack a sprite run', () => {
    expect(Barrel.SPRITE_STRIDE).toBe(9);
  });
});

describe('test seams', () => {
  it('keeps them off the package barrel', () => {
    expect(Object.keys(Barrel).filter((k) => k.endsWith('ForTests'))).toEqual([]);
  });

  it('reaches every one through the test-seams entry', async () => {
    const seams = await import('@weasel-js/core/test-seams');
    expect(Object.keys(seams).length).toBeGreaterThan(0);
    expect(Object.keys(seams).every((k) => k.endsWith('ForTests'))).toBe(true);
  });
});
