import { describe, expect, it } from 'vitest';
import { pathFromD, type PolygonPath } from '@weasel-js/geom';
import { asNodeId, type NodeId } from '@weasel-js/core';
import { linkTargetAt } from './linkAnchor';

describe('linkTargetAt', () => {
  it('passes over hidden and locked nodes for the one under them', () => {
    const paths: Record<string, PolygonPath> = {
      edited: pathFromD('M0 0 H5') as PolygonPath,
      under: pathFromD('M10 0 H20') as PolygonPath,
      hidden: pathFromD('M10 0 H30') as PolygonPath,
      locked: pathFromD('M10 0 H40') as PolygonPath,
    };
    const nodes = Object.keys(paths).map((id) => ({ id: asNodeId(id), data: {} }));
    const scene = {
      renderOrderNodes: () => nodes,
      isHidden: (id: NodeId) => id === 'hidden',
      isLocked: (id: NodeId) => id === 'locked',
    };
    const dep = { editingId: 'edited', getEditablePath: (id: string) => paths[id] };
    expect(linkTargetAt(scene as never, dep, { x: 10, y: 0 }, 2)?.id).toBe('under');
  });
});
