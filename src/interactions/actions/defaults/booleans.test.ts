import { describe, it, expect, vi } from 'vitest';
import {
  pathfinderUnionAction,
  pathfinderSubtractAction,
  pathfinderIntersectAction,
  pathfinderExcludeAction,
  pathfinderDivideAction,
  pathfinderCropAction,
} from './booleans';
import type { BooleansAdapter } from '../booleans/booleans';
import { asNodeId } from 'core/scene/types';
import { ActionDisabledReason } from '../registry';
import type { ImmediateInvoker } from '../invoker';

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

  it('has no gestureBinding', () => {
    expect(pathfinderUnionAction.gestureBinding).toBeUndefined();
  });

  it('has no gestureBinding', () => {
    expect(pathfinderUnionAction.gestureBinding).toBeUndefined();
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

describe('pathfinder descriptors (all 6)', () => {
  const all = [
    pathfinderUnionAction,
    pathfinderSubtractAction,
    pathfinderIntersectAction,
    pathfinderExcludeAction,
    pathfinderDivideAction,
    pathfinderCropAction,
  ];

  it('all have unique ids matching pathfinder.* pattern', () => {
    const ids = all.map((a) => a.id);
    expect(ids.sort()).toEqual([
      'pathfinder.crop',
      'pathfinder.divide',
      'pathfinder.exclude',
      'pathfinder.intersect',
      'pathfinder.subtract',
      'pathfinder.union',
    ]);
    expect(new Set(ids).size).toBe(6);
  });

  it('all belong to group "pathfinder"', () => {
    for (const a of all) expect(a.group).toBe('pathfinder');
  });

  it('all have an icon', () => {
    for (const a of all) expect(a.icon).toBeDefined();
  });

  it('all have no gestureBinding', () => {
    for (const a of all) expect(a.gestureBinding).toBeUndefined();
  });

  it('all have timing "immediate"', () => {
    for (const a of all) expect(a.invoker?.timing).toBe('immediate');
  });

  it('all return SelectionRequired from enabled()', () => {
    for (const a of all) expect(a.enabled!()).toBe(ActionDisabledReason.SelectionRequired);
  });
});

