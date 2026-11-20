import { describe, expect, it } from 'vitest';
import { asNodeId } from '@weasel-js/core';
import { auditNodeSpecs, createAuditScene, frameIdOf, syncAuditScene, type AuditPalette } from './auditScene';
import type { AuditCellData } from './auditPainter';
import { layoutMap } from './mapLayout';
import { phasesOf } from './phases';
import { rampAt } from './heat';
import fixture from './fixture.map.json';
import type { SkulkMap } from './skulkMap.types';

const map = fixture as unknown as SkulkMap;
const PALETTE: AuditPalette = {
  panel: '#ffffff', band: '#eeeeee', ink: '#111111', inkInverse: '#ffffff', uncharted: '#dddddd', hatch: '#aaaaaa',
  depth: ['#eef4fa', '#c6dcef', '#8fb6d9', '#3f78a8', '#173f63'], settled: '#6fae84', live: '#e0457b',
  font: { ui: 'Oswald', numeric: 'Oswald Tabular' },
  phase: { review: '#2e1a6b', reviewed: '#8a1a7c', match: '#d2373a', fix: '#f08a2c', patch: '#f4e7a1', conflict: '#d23b2a', done: '#777777' },
};

const cellOf = (scene: ReturnType<typeof createAuditScene>, id: string) => scene.get(asNodeId(id))!.data as AuditCellData;

describe('the audit scene', () => {
  it('holds a frame per package, which never picks, and a cell per area', () => {
    const scene = createAuditScene();
    syncAuditScene(scene, auditNodeSpecs(map.areas, layoutMap(map.areas, 900, 400), PALETTE));
    expect(scene.get(frameIdOf('core'))?.pickable).toBe(false);
    expect(scene.nodesOnLayer('map').map((n) => n.id)).toEqual(expect.arrayContaining(map.areas.map((a) => a.id)));
    expect(cellOf(scene, 'core.ops')).toMatchObject({ live: PALETTE.live, dots: 1, fill: { color: PALETTE.depth[2] } });
    expect(cellOf(scene, 'ui.menu')).toMatchObject({ fill: { color: PALETTE.uncharted }, over: { kind: 'hatch' }, queue: 1 });
    expect(cellOf(scene, 'core.scene').ink).toBe(PALETTE.inkInverse);
    expect(scene.history.canUndo()).toBe(false);
  });

  it("outlines a live area's cell in its phase's color", () => {
    const scene = createAuditScene();
    syncAuditScene(scene, auditNodeSpecs(map.areas, layoutMap(map.areas, 900, 400), PALETTE, phasesOf(map.runs)));
    expect(cellOf(scene, 'core.ops').live).toBe(PALETTE.phase.fix);
    expect(cellOf(scene, 'core.debug').live).toBe(PALETTE.phase.reviewed);
    expect(cellOf(scene, 'geom').live).toBeUndefined();
  });

  it('keeps each node through a refresh, so the selection on it survives', () => {
    const scene = createAuditScene();
    syncAuditScene(scene, auditNodeSpecs(map.areas, layoutMap(map.areas, 900, 400), PALETTE));
    scene.setSelection([asNodeId('geom')]);
    const before = scene.incarnation(asNodeId('geom'));
    const fewer = map.areas.filter((a) => a.id !== 'ui.menu');
    syncAuditScene(scene, auditNodeSpecs(fewer, layoutMap(fewer, 600, 300), PALETTE));
    expect(scene.incarnation(asNodeId('geom'))).toBe(before);
    expect(scene.getSelection()).toEqual(['geom']);
    expect(scene.get(asNodeId('ui.menu'))).toBeUndefined();
  });
});

describe('syncAuditScene', () => {
  it('keeps a cell, and its selection, when a frame above it moves under a new frame', () => {
    const scene = createAuditScene();
    const specs = auditNodeSpecs(map.areas, layoutMap(map.areas, 900, 400), PALETTE);
    syncAuditScene(scene, specs);
    const cell = specs.find((sp) => sp.pickable && sp.parent !== null)!;
    const frame = specs.find((sp) => sp.id === cell.parent)!;
    scene.setSelection([cell.id]);
    const before = scene.incarnation(cell.id);
    const between = { ...frame, id: asNodeId(`${frame.id}~new`) };
    const next = specs.flatMap((sp) => (sp.id === frame.id ? [between, { ...frame, parent: between.id }] : [sp]));
    syncAuditScene(scene, next);
    expect(scene.get(frame.id)?.parent).toBe(between.id);
    expect(scene.incarnation(cell.id)).toBe(before);
    expect(scene.getSelection()).toEqual([cell.id]);
  });
});

describe('rampAt', () => {
  it('mixes between the two oklch stops a place falls between, the short way round the hue', () => {
    const stops = ['oklch(0.2 0.1 300)', 'oklch(0.6 0.2 20)', 'oklch(0.9 0.1 100)'];
    expect(rampAt(stops, 0)).toBe('oklch(0.2000 0.1000 300.00)');
    expect(rampAt(stops, 0.25)).toBe('oklch(0.4000 0.1500 340.00)');
    expect(rampAt(stops, 1)).toBe('oklch(0.9000 0.1000 100.00)');
    expect(rampAt(['#000000', '#ffffff'], 0.7)).toBe('#ffffff');
  });
});
