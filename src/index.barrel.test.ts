import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as Barrel from './index';

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

  // The Bundle Inspector (`apps/draw/src/dev/registryData.ts`) used
  // to hardcode `SHAPE_KIND_IDS` mirrored from `BuiltinShapeToolId`. The kit
  // is now the source of truth — assert every shape kind the inspector
  // expects is present on the kit-exported tuple. Adding a new builtin shape
  // tool that isn't appended here fails this test.
  it('exports KIT_SHAPE_KINDS covering every BuiltinShapeToolId', () => {
    const kinds = (Barrel as Record<string, unknown>).KIT_SHAPE_KINDS;
    expect(Array.isArray(kinds), 'KIT_SHAPE_KINDS must be exported as an array').toBe(true);
    const arr = kinds as readonly string[];
    expect(arr.length).toBeGreaterThan(0);
    // Source the canonical list from the type-defining file. The string
    // literals in the `BuiltinShapeToolId` union are the contract.
    const shapeToolsSrc = readFileSync(
      join(ROOT, 'canvas', 'SceneCanvas', 'useBuiltinShapeTools.tsx'),
      'utf8',
    );
    const unionMatch = shapeToolsSrc.match(
      /export\s+type\s+BuiltinShapeToolId\s*=([^;]+);/,
    );
    expect(unionMatch, 'could not locate BuiltinShapeToolId union').not.toBeNull();
    const expected = [...unionMatch![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(expected.length).toBeGreaterThan(0);
    const missing = expected.filter((id) => !arr.includes(id));
    expect(missing, `BuiltinShapeToolId members missing from KIT_SHAPE_KINDS: ${missing.join(', ')}`).toEqual([]);
  });

  it('exports defaultNodeRouting covering every KIT_SHAPE_KINDS entry', () => {
    const kinds = (Barrel as Record<string, unknown>).defaultNodeRouting;
    const shapeKinds = (Barrel as Record<string, unknown>).KIT_SHAPE_KINDS as readonly string[];
    expect(Array.isArray(kinds), 'defaultNodeRouting must be exported as an array').toBe(true);
    const names = (kinds as { name: string }[]).map((k) => k.name);
    const missing = shapeKinds.filter((s) => !names.includes(s));
    expect(
      missing,
      `KIT_SHAPE_KINDS entries missing from defaultNodeRouting: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  // `apps/draw/src/dev/registryData.ts` previously mirrored
  // `BUNDLE_DEFINITIONS` from the kit's internal `BUNDLE_TOOLS` map. Now the
  // kit ships it directly — assert the export exists, names every
  // `ToolBundle` id, and lists tool ids for each.
  it('exports BUNDLE_TOOLS mapping every ToolBundle id to its tool ids', () => {
    const table = (Barrel as Record<string, unknown>).BUNDLE_TOOLS as
      | Record<string, readonly string[]>
      | undefined;
    expect(table, 'BUNDLE_TOOLS must be exported').toBeDefined();
    // The `ToolBundle` type union is the contract for the keys.
    const sceneCanvasSrc = readFileSync(
      join(ROOT, 'canvas', 'SceneCanvas.tsx'),
      'utf8',
    );
    const unionMatch = sceneCanvasSrc.match(
      /export\s+type\s+ToolBundle\s*=([^;]+);/,
    );
    expect(unionMatch, 'could not locate ToolBundle union').not.toBeNull();
    const expectedKeys = [...unionMatch![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(expectedKeys.length).toBeGreaterThan(0);
    const missingKeys = expectedKeys.filter((id) => !(id in table!));
    expect(missingKeys, `ToolBundle ids missing from BUNDLE_TOOLS: ${missingKeys.join(', ')}`).toEqual([]);
    for (const key of expectedKeys) {
      const tools = table![key];
      expect(Array.isArray(tools), `BUNDLE_TOOLS.${key} must be an array`).toBe(true);
      expect(tools.length, `BUNDLE_TOOLS.${key} must be non-empty`).toBeGreaterThan(0);
    }
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
  });
});
