/** A scene's painters answer for it alone, ahead of the default's, and leave when released. */
import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { findNodeShape, findShapeSilhouette, getNodeShapes, registerNodeShape, shapeCoversPoint } from './NodeShape';
import { createNodeShapes, defaultNodeShapes, nodeShapesOf, scopedShapeClaims } from './nodeShapeRegistry';
import type { NodeShapeEntry } from './nodeShapeTypes';
import { pathFromD } from '@weasel-js/geom';

const isGem = (data: unknown) => typeof data === 'object' && data !== null && 'gem' in data;
const diamond = pathFromD('M50 0 L100 50 L50 100 L0 50 Z');
const gem: NodeShapeEntry = { id: 'test:gem', matches: (n) => isGem(n.data), paint: () => [], silhouette: () => diamond };
const node = { id: asNodeId('g'), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 100, height: 100 }, data: { gem: {} } } as never;

describe('scene-scoped node shapes', () => {
  it("resolves a scene's own painter for that scene only", () => {
    const a = createScene({ systemLayers: [{ id: 'default' }] });
    const b = createScene({ systemLayers: [{ id: 'default' }] });
    const release = nodeShapesOf(a).register(gem);
    expect(findNodeShape(node, nodeShapesOf(a))).toBe(gem);
    expect(findNodeShape(node, nodeShapesOf(b))?.id).toBe('kit:rect-fallback');
    expect(findNodeShape(node)?.id).toBe('kit:rect-fallback');
    expect(shapeCoversPoint(node, (node as { pose: unknown }).pose, 3, 97, { shapes: nodeShapesOf(a) })).toBe(false);
    expect(shapeCoversPoint(node, (node as { pose: unknown }).pose, 3, 97, { shapes: nodeShapesOf(b) })).toBe(true);
    expect(findShapeSilhouette(node, (node as { pose: unknown }).pose, { shapes: nodeShapesOf(a) })).not.toBeNull();
    expect(scopedShapeClaims(node)).toBe(true);
    release();
    expect(findNodeShape(node, nodeShapesOf(a))?.id).toBe('kit:rect-fallback');
    expect(scopedShapeClaims(node)).toBe(false);
  });

  it('keeps a painter registered twice until both registrations are released', () => {
    const shapes = createNodeShapes();
    const one = shapes.register(gem);
    const two = shapes.register(gem);
    one();
    expect(findNodeShape(node, shapes)).toBe(gem);
    two();
    expect(findNodeShape(node, shapes)).not.toBe(gem);
  });

  it("puts a scene's normal painters after the built-ins and its high ones ahead of the default's", () => {
    const shapes = createNodeShapes();
    const high: NodeShapeEntry = { ...gem, id: 'test:high' };
    const offHigh = shapes.register(high, { priority: 'high' });
    const offGlobal = registerNodeShape({ ...gem, id: 'test:global-high' }, { priority: 'high' });
    const offNormal = shapes.register(gem);
    const ids = getNodeShapes(shapes).map((e) => e.id);
    expect(ids.indexOf('test:high')).toBeLessThan(ids.indexOf('test:global-high'));
    expect(ids.indexOf('kit:text')).toBeLessThan(ids.indexOf('test:gem'));
    expect(ids.at(-1)).toBe('kit:rect-fallback');
    expect(getNodeShapes(defaultNodeShapes).map((e) => e.id)).not.toContain('test:high');
    offHigh(); offGlobal(); offNormal();
  });
});
