import { describe, expect, it } from 'vitest';
import type { GroupDrawCommand } from '../../renderer';
import { createPathLayer } from './pathLayer';
import { rectPath } from './builder';
import type { Path } from './types';
import type { Paint, Stroke } from '../../core/paint-types';

describe('createPathLayer', () => {
  it('emits one path command per visible node, wrapped in a world-transform group', () => {
    const path: Path = rectPath(0, 0, 10, 10);
    const fill: Paint = { fill: 'solid', color: '#fff' };
    const layer = createPathLayer({
      getNodes: () => [{ id: 'a' }, { id: 'b' }],
      getPath: () => path,
      getFill: () => fill,
    });
    const tree = layer.draw(null, { x: 0, y: 0, scale: 1 }, { width: 100, height: 100 });
    expect(tree).toHaveLength(1);
    expect(tree[0].kind).toBe('group');
    const group = tree[0] as GroupDrawCommand;
    expect(group.children).toHaveLength(2);
    expect(group.children[0]).toMatchObject({ kind: 'path', path, fill });
    expect(group.children[1]).toMatchObject({ kind: 'path', path, fill });
  });

  it('skips hidden nodes', () => {
    const path: Path = rectPath(0, 0, 10, 10);
    const layer = createPathLayer({
      getNodes: () => [{ id: 'a' }, { id: 'b' }],
      getPath: () => path,
      getFill: () => ({ fill: 'solid', color: '#f00' }),
      isHidden: (n) => n.id === 'b',
    });
    const tree = layer.draw(null, { x: 0, y: 0, scale: 1 }, { width: 100, height: 100 });
    const group = tree[0] as GroupDrawCommand;
    expect(group.children).toHaveLength(1);
  });

  it('skips nodes with no fill and no stroke', () => {
    const path: Path = rectPath(0, 0, 10, 10);
    const layer = createPathLayer({
      getNodes: () => [{ id: 'a' }],
      getPath: () => path,
      // no getFill or getStroke
    });
    const tree = layer.draw(null, { x: 0, y: 0, scale: 1 }, { width: 100, height: 100 });
    const group = tree[0] as GroupDrawCommand;
    expect(group.children).toHaveLength(0);
  });

  it('passes stroke through when getStroke returns a stroke', () => {
    const path: Path = rectPath(0, 0, 10, 10);
    const stroke: Stroke = { paint: { fill: 'solid', color: '#000' }, width: 2 };
    const layer = createPathLayer({
      getNodes: () => [{ id: 'a' }],
      getPath: () => path,
      getStroke: () => stroke,
    });
    const tree = layer.draw(null, { x: 0, y: 0, scale: 1 }, { width: 100, height: 100 });
    const group = tree[0] as GroupDrawCommand;
    expect(group.children[0]).toMatchObject({ kind: 'path', path, stroke });
  });

  it('group transform reflects the view (scale=2 → mat3 scale=2)', () => {
    const path: Path = rectPath(0, 0, 10, 10);
    const layer = createPathLayer({
      getNodes: () => [{ id: 'a' }],
      getPath: () => path,
      getFill: () => ({ fill: 'solid', color: '#fff' }),
    });
    const tree = layer.draw(null, { x: 5, y: 7, scale: 2 }, { width: 100, height: 100 });
    const group = tree[0] as GroupDrawCommand;
    expect(group.transform).toBeDefined();
    expect(Array.from(group.transform!)).toEqual([2, 0, 0, 0, 2, 0, -10, -14, 1]);
  });
});
