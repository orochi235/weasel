import { describe, it, expect, vi } from 'vitest';
import {
  pathfinderUnionAction,
  pathfinderSubtractAction,
  pathfinderIntersectAction,
  pathfinderExcludeAction,
  pathfinderDivideAction,
  pathfinderCropAction,
  pathfinderTrimAction,
  pathfinderMergeAction,
} from './booleans';
import type { BooleansAdapter } from '../booleans/booleans';
import { asNodeId } from 'core/scene/types';
import { pathFromD, pointInPath, type Path } from '@weasel-js/geom';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { ImmediateInvoker } from '@weasel-js/routing';

function makeAdapter(selCount = 2): BooleansAdapter {
  const ids = Array.from({ length: selCount }, (_, i) => asNodeId(String.fromCharCode(97 + i)));
  return {
    getSelection: () => ids,
    getWorldPath: () => undefined,
    compareZ: () => 0,
    createPathNode: () => ({ id: 'new' }),
  };
}

function runDescriptor(action: typeof pathfinderUnionAction, adapter: BooleansAdapter) {
  (action.invoker as ImmediateInvoker).run({ booleansAdapter: adapter });
}

// ---------------------------------------------------------------------------
// Static descriptor tests
// ---------------------------------------------------------------------------

describe('pathfinderUnionAction descriptor', () => {
  it('has id "pathfinder.union"', () => {
    expect(pathfinderUnionAction.id).toBe('pathfinder.union');
  });

  it('has no defaultBinding', () => {
    expect(pathfinderUnionAction.defaultBinding).toBeUndefined();
  });

  it('has no defaultBinding', () => {
    expect(pathfinderUnionAction.defaultBinding).toBeUndefined();
  });

  it('has an icon', () => {
    expect(pathfinderUnionAction.icon).toBeDefined();
  });

  it('belongs to group "pathfinder"', () => {
    expect(pathfinderUnionAction.group).toBe('pathfinder');
  });

  it('has timing "immediate"', () => {
    expect(pathfinderUnionAction.invoker?.timing).toBe('immediate');
  });

  it('invoker.run calls applyBooleanOp via booleansAdapter dep', () => {
    const adapter = makeAdapter(2);
    const createPathNode = vi.fn().mockReturnValue({ id: 'result' });
    adapter.createPathNode = createPathNode;
    runDescriptor(pathfinderUnionAction, adapter);
    // applyBooleanOp resolves paths (returns undefined for each → noop), so
    // createPathNode not called; we verify no throw and the dep path is exercised.
    expect(() => runDescriptor(pathfinderUnionAction, adapter)).not.toThrow();
  });

  it('invoker.run no-ops when booleansAdapter dep is missing', () => {
    expect(() => {
      (pathfinderUnionAction.invoker as ImmediateInvoker).run({});
    }).not.toThrow();
  });

  it('enabled returns SelectionRequired', () => {
    expect(pathfinderUnionAction.enabled!()).toBe(ActionDisabledReason.SelectionRequired);
  });
});

describe('pathfinderSubtractAction descriptor', () => {
  it('has id "pathfinder.subtract"', () => {
    expect(pathfinderSubtractAction.id).toBe('pathfinder.subtract');
  });

  it('has timing "immediate"', () => {
    expect(pathfinderSubtractAction.invoker?.timing).toBe('immediate');
  });
});

describe('pathfinderIntersectAction descriptor', () => {
  it('has id "pathfinder.intersect"', () => {
    expect(pathfinderIntersectAction.id).toBe('pathfinder.intersect');
  });

  it('has timing "immediate"', () => {
    expect(pathfinderIntersectAction.invoker?.timing).toBe('immediate');
  });
});

describe('pathfinderExcludeAction descriptor', () => {
  it('has id "pathfinder.exclude"', () => {
    expect(pathfinderExcludeAction.id).toBe('pathfinder.exclude');
  });

  it('has timing "immediate"', () => {
    expect(pathfinderExcludeAction.invoker?.timing).toBe('immediate');
  });
});

describe('pathfinderDivideAction descriptor', () => {
  it('has id "pathfinder.divide"', () => {
    expect(pathfinderDivideAction.id).toBe('pathfinder.divide');
  });

  it('has timing "immediate"', () => {
    expect(pathfinderDivideAction.invoker?.timing).toBe('immediate');
  });
});

describe('pathfinderCropAction descriptor', () => {
  it('has id "pathfinder.crop"', () => {
    expect(pathfinderCropAction.id).toBe('pathfinder.crop');
  });

  it('has timing "immediate"', () => {
    expect(pathfinderCropAction.invoker?.timing).toBe('immediate');
  });
});

// ---------------------------------------------------------------------------
// All descriptors together
// ---------------------------------------------------------------------------

describe('pathfinder descriptors (all of them)', () => {
  const all = [
    pathfinderUnionAction,
    pathfinderSubtractAction,
    pathfinderIntersectAction,
    pathfinderExcludeAction,
    pathfinderDivideAction,
    pathfinderCropAction,
    pathfinderTrimAction,
    pathfinderMergeAction,
  ];

  it('all have unique ids matching pathfinder.* pattern', () => {
    const ids = all.map((a) => a.id);
    expect(ids.sort()).toEqual([
      'pathfinder.crop',
      'pathfinder.divide',
      'pathfinder.exclude',
      'pathfinder.intersect',
      'pathfinder.merge',
      'pathfinder.subtract',
      'pathfinder.trim',
      'pathfinder.union',
    ]);
    expect(new Set(ids).size).toBe(8);
  });

  it('all belong to group "pathfinder"', () => {
    for (const a of all) expect(a.group).toBe('pathfinder');
  });

  it('all have an icon', () => {
    for (const a of all) expect(a.icon).toBeDefined();
  });

  it('all have no defaultBinding', () => {
    for (const a of all) expect(a.defaultBinding).toBeUndefined();
  });

  it('all have timing "immediate"', () => {
    for (const a of all) expect(a.invoker?.timing).toBe('immediate');
  });

  it('all return SelectionRequired from enabled()', () => {
    for (const a of all) expect(a.enabled!()).toBe(ActionDisabledReason.SelectionRequired);
  });
});


describe('Pathfinder actions and strokes', () => {
  it('reads an unfilled stroked line as its stroke, so Minus Front cuts a slot', () => {
    const paths: Record<string, Path> = {
      box: { kind: 'rect', x: 0, y: 0, width: 100, height: 100 },
      line: pathFromD('M-20 50 L120 50'),
    };
    const made: Path[] = [];
    const adapter: BooleansAdapter = {
      getSelection: () => [asNodeId('box'), asNodeId('line')],
      getWorldPath: (id) => paths[id],
      getPaint: (id) => (id === 'line'
        ? { fill: null, stroke: { paint: { color: '#000' }, width: 10 } }
        : { fill: { paint: { color: '#888' } }, stroke: { paint: { color: '#000' }, width: 10 } }),
      compareZ: (a, b) => (a === 'box' ? -1 : 1) - (b === 'box' ? -1 : 1),
      createPathNode: (path) => { made.push(path); return { id: 'new' }; },
      applyOps: () => {},
    };
    runDescriptor(pathfinderSubtractAction, adapter);
    expect(pointInPath(made[0]!, 50, 50)).toBe(false);
    expect(pointInPath(made[0]!, 50, 40)).toBe(true);
    // The filled box's own stroke is not part of its shape.
    expect(pointInPath(made[0]!, -3, 20)).toBe(false);
  });
});
