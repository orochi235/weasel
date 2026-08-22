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
