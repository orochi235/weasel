import { describe, expect, it } from 'vitest';
import { asNodeId } from '@weasel-js/core';
import { auditNodeSpecs, createAuditScene, frameIdOf, syncAuditScene, type AuditPalette } from './auditScene';
import type { AuditCellData } from './auditPainter';
import { layoutMap } from './mapLayout';
import { phasesOf } from './phases';
import fixture from './fixture.map.json';
import type { SkulkMap } from './skulkMap.types';

const map = fixture as unknown as SkulkMap;
const PALETTE: AuditPalette = {
  panel: '#ffffff', ink: '#111111', inkInverse: '#ffffff', uncharted: '#dddddd', hatch: '#aaaaaa',
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
    expect(scene.nodesOnLayer('cells').map((n) => n.id)).toEqual(expect.arrayContaining(map.areas.map((a) => a.id)));
    expect(cellOf(scene, 'core.ops')).toMatchObject({ live: PALETTE.live, dots: 1, fill: { color: PALETTE.depth[1] } });
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
