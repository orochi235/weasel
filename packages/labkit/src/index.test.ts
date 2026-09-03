import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as labkit from './index';

/** The barrels the public surface is assembled from. Type-only exports are
 *  erased at runtime, so the names are read out of the source rather than off
 *  the module object. */
const BARRELS = ['./index.ts', './lab/index.ts', './trial/index.ts', './state/index.ts'];

function exportedNames(): string[] {
  const names: string[] = [];
  for (const barrel of BARRELS) {
    const src = readFileSync(fileURLToPath(new URL(barrel, import.meta.url)), 'utf8');
    for (const [, body] of src.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
      for (const clause of body.split(',')) {
        const name = clause
          .trim()
          .split(/\s+as\s+/)
          .pop()
          ?.replace(/^type\s+/, '')
          .trim();
        if (name) names.push(name);
      }
    }
  }
  return names;
}

describe('public export surface', () => {
  it('names the grid, not a tile, when it says Workspace', () => {
    const offenders = exportedNames().filter(
      (n) => n.startsWith('Workspace') && n !== 'Workspace' && n !== 'WorkspaceProps',
    );
    expect(offenders).toEqual([]);
  });

  it('exports no Experiment symbol that means anything per-tile', () => {
    const offenders = exportedNames().filter(
      (n) => n.includes('Experiment') && !n.startsWith('SingletonExperiment'),
    );
    expect(offenders).toEqual([]);
  });

  it('exports the tile as Trial and the area it sits in as Workspace', () => {
    expect(labkit).toHaveProperty('Trial');
    expect(labkit).toHaveProperty('TrialChrome');
    expect(labkit).toHaveProperty('Workspace');
    expect(labkit).toHaveProperty('useTrialState');
    expect(labkit).toHaveProperty('useTrialId');
  });
});

describe('surface, job and orbit entry points', () => {
  it('are reachable from the package root', async () => {
    const kit = await import('./index');
    expect(typeof kit.useTiledSurface).toBe('function');
    expect(typeof kit.useSurfaceTile).toBe('function');
    expect(typeof kit.useSurface).toBe('function');
    expect(typeof kit.useSurfaceOptional).toBe('function');
    expect(typeof kit.toDeviceRect).toBe('function');
    expect(typeof kit.composeRects).toBe('function');
    expect(typeof kit.createAnnotationStore).toBe('function');
    expect(typeof kit.createAnnotationScene).toBe('function');
    expect(typeof kit.annotationsFromJSON).toBe('function');
    expect(typeof kit.seenFrom).toBe('function');
    expect(typeof kit.fracToWorld).toBe('function');
    expect(typeof kit.useOrbit).toBe('function');
    expect(typeof kit.orbitAfterDrag).toBe('function');
    expect(typeof kit.useJob).toBe('function');
    expect(typeof kit.as2DView).toBe('function');
    expect(kit.SurfaceContext).toBeDefined();
    expect(kit.SurfaceCanvasContext).toBeDefined();
    expect(typeof kit.useSurfaceCanvas).toBe('function');
  });
});

describe('the annotations capability', () => {
  it('reaches a host through the package root', async () => {
    const kit = await import('./index');
    expect(typeof kit.useAnnotations).toBe('function');
    expect(typeof kit.useAnnotationsOptional).toBe('function');
    expect(typeof kit.AnnotationTargets).toBe('function');
    expect(typeof kit.AnnotationOverlay).toBe('function');
    expect(typeof kit.markCommands).toBe('function');
    expect(typeof kit.annotationToolInfo).toBe('function');
    expect(typeof kit.fitView).toBe('function');
    expect(kit.ANNOTATION_TOOLS.map((t) => t.id)).toContain('arrow');
    expect(typeof kit.MarkList).toBe('function');
    expect(kit.DEFAULT_VIEW).toEqual({ zoom: 1, pan: { x: 0, y: 0 } });
  });
});
