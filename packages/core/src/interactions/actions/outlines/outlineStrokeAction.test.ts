import { describe, it, expect, vi } from 'vitest';
import { stubDeps } from '../testUtils';
import { buildDepsFromRequires, ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import type { DepRegistry } from '@weasel-js/routing/react';
import { pathFromD } from '@weasel-js/geom';
import { asNodeId } from 'core/scene/types';
import type { PathPaint } from 'canvas/nodeShapes/nodePaint';
import type { CreateOutlinesAdapter } from './createOutlines';
import { outlineStrokeAction } from './outlineStrokeAction';
import { rootsTree } from 'core/adapters/testing/rootsTree';

const STROKED: PathPaint = { fill: null, stroke: { paint: { color: '#000' }, width: { px: 8 } } };

function makeAdapter(paints: Record<string, PathPaint>, ids = Object.keys(paints)) {
  const created: { height: number }[] = [];
  const adapter: CreateOutlinesAdapter = {
    ...rootsTree(),
    getSelection: () => ids.map(asNodeId),
    getTextSource: () => undefined,
    getWorldPath: (id) => (paints[id] ? pathFromD('M0 0 L50 0') : undefined),
    getPaint: (id) => paints[id],
    createPathNode: (path) => {
      const ys = [...(path as { coords: Float32Array }).coords].filter((_, i) => i % 2 === 1);
      created.push({ height: Math.max(...ys) - Math.min(...ys) });
      return { id: 'outlined' };
    },
    applyOps: vi.fn(),
  };
  return { adapter, created };
}

const selectionOf = (ids: string[]) => ({ get: () => ids.map(asNodeId) });

describe('outlineStrokeAction', () => {
  it('declares every dep it reads', () => {
    const { adapter } = makeAdapter({});
    const bag: Record<string, unknown> = { selection: selectionOf([]), createOutlinesAdapter: adapter };
    const registry = { get: (name: string) => bag[name] } as unknown as DepRegistry;
    const deps = buildDepsFromRequires(outlineStrokeAction, registry);
    expect(() => outlineStrokeAction.enabled?.(deps)).not.toThrow();
    expect(() => (outlineStrokeAction.invoker as ImmediateInvoker).run(deps, {})).not.toThrow();
  });

  it('is enabled only while the selection holds a stroked path', () => {
    const { adapter } = makeAdapter({ line: STROKED, plain: { fill: { paint: { color: '#888' } } } });
    const on = (ids: string[]) =>
      outlineStrokeAction.enabled?.(stubDeps({ selection: selectionOf(ids), createOutlinesAdapter: adapter }));
    expect(on(['plain', 'line'])).toBe(true);
    expect(on(['plain'])).toBe(ActionDisabledReason.NotApplicable);
    expect(on([])).toBe(ActionDisabledReason.SelectionRequired);
  });

  it('outlines a { px } width at the view scale', () => {
    const { adapter, created } = makeAdapter({ line: STROKED });
    const view = { get: () => ({ x: 0, y: 0, scale: { x: 4, y: 4 } }) };
    (outlineStrokeAction.invoker as ImmediateInvoker).run(
      stubDeps({ selection: selectionOf(['line']), createOutlinesAdapter: adapter, view }), {},
    );
    expect(created).toHaveLength(1);
    expect(created[0]!.height).toBeCloseTo(2);
  });
});
