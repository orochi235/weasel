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

  it('measures both an anchor and a segment within reachPx on screen under a non-uniform zoom', () => {
    const paths: Record<string, PolygonPath> = {
      edited: pathFromD('M-50 -50 H-40') as PolygonPath,
      other: pathFromD('M0 0 H100') as PolygonPath,
    };
    const nodes = Object.keys(paths).map((id) => ({ id: asNodeId(id), data: {} }));
    const scene = { renderOrderNodes: () => nodes };
    const dep = { editingId: 'edited', getEditablePath: (id: string) => paths[id] };
    const scale = { x: 4, y: 1 };
    // (50, 20) is 20 screen px from the segment; (2, 0) is 8 from the anchor, so on the segment.
    expect(linkTargetAt(scene as never, dep, { x: 50, y: 20 }, 6, scale)).toBeNull();
    expect(linkTargetAt(scene as never, dep, { x: 50, y: 5 }, 6, scale)?.kind).toBe('onPath');
    expect(linkTargetAt(scene as never, dep, { x: 2, y: 0 }, 6, scale)?.kind).toBe('onPath');
    expect(linkTargetAt(scene as never, dep, { x: 1, y: 0 }, 6, scale)?.kind).toBe('coincident');
  });
});
