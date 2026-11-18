import { describe, expect, it } from 'vitest';
import { dropSymmetrySwitch, featureSettingsToGroups, gridToGroup, pathAidsToGroup, renamePathAids, renamePathTools } from './prefsMigration';

describe('path aid migrations', () => {
  it('carries a version 2 balance and corners toggle through to Poise and Fillet', () => {
    const records = new Map<string, unknown>([
      ['view.pathBalance', false],
      ['view.pathCorners', true],
    ]);
    pathAidsToGroup(records as never);
    renamePathAids(records as never);
    expect(Object.fromEntries(records)).toEqual({
      'view.pathEditing.pathPoise': false,
      'view.pathEditing.pathFillets': true,
    });
  });

  it('keeps a value already stored under the new name', () => {
    const records = new Map<string, unknown>([
      ['view.pathEditing.pathCorners', false],
      ['view.pathEditing.pathFillets', true],
    ]);
    renamePathAids(records as never);
    expect(Object.fromEntries(records)).toEqual({ 'view.pathEditing.pathFillets': true });
  });

  it('carries the renamed tools\' options, last use, and the Fillet asset\'s surface and toolbar place', () => {
    const place = { x: 4, y: 8, anchor: null, orientation: 'horizontal' };
    const records = new Map<string, unknown>([
      ['tools.smudgeBrush.radiusPx', 30],
      ['tools.simplifyBrush.radiusPx', 12],
      ['tools.lastTool', 'lengthen'],
      ['ui.surfaces', { corners: { surface: 'panel', collapsed: true }, layers: { hidden: true } }],
      ['ui.toolbars', { docks: { strip: [['file', 'corners'], ['view']] }, floating: { corners: place } }],
    ]);
    renamePathTools(records as never);
    expect(Object.fromEntries(records)).toEqual({
      'tools.knead.radiusPx': 30,
      'tools.sand.radiusPx': 12,
      'tools.lastTool': 'tug',
      'ui.surfaces': { fillets: { surface: 'panel', collapsed: true }, layers: { hidden: true } },
      'ui.toolbars': { docks: { strip: [['file', 'fillets'], ['view']] }, floating: { fillets: place } },
    });
  });

  it("carries Corner shape's far-end place, and drops a stale corners beside fillets", () => {
    const records = new Map<string, unknown>([
      ['ui.toolbars', { docks: { strip: [['file', 'corners', 'fillets'], ['corners']] }, floating: {}, atEnd: ['corners'] }],
    ]);
    renamePathTools(records as never);
    expect(records.get('ui.toolbars')).toEqual({ docks: { strip: [['file', 'fillets'], ['fillets']] }, floating: {}, atEnd: ['fillets'] });
  });

  it('leaves a last tool and surfaces no rename touched as they are', () => {
    const surfaces = { layers: { hidden: true } };
    const records = new Map<string, unknown>([['tools.lastTool', 'pen'], ['ui.surfaces', surfaces]]);
    renamePathTools(records as never);
    expect(records.get('tools.lastTool')).toBe('pen');
    expect(records.get('ui.surfaces')).toBe(surfaces);
  });
});

describe('gridToGroup', () => {
  it('moves the grid leaves into the Grid group, keeping a value already there', () => {
    const records = new Map<string, unknown>([
      ['view.gridVisible', true],
      ['view.gridDensity', 40],
      ['view.snapToGrid', true],
      ['view.grid.snap', false],
    ]);
    gridToGroup(records as never);
    expect(Object.fromEntries(records)).toEqual({ 'view.grid.visible': true, 'view.grid.spacing': 40, 'view.grid.snap': false });
  });
});

describe('featureSettingsToGroups', () => {
  it("moves the rulers, symmetry and path edit aids into their packages' groups, keeping a value already there", () => {
    const records = new Map<string, unknown>([
      ['view.rulersVisible', true],
      ['view.symmetry', true],
      ['view.symmetryAxis', 'both'],
      ['view.pathEditing.pathComb', true],
      ['view.pathEditing.pathFillets', false],
      ['view.pathEditing.fillets', true],
    ]);
    featureSettingsToGroups(records as never);
    expect(Object.fromEntries(records)).toEqual({
      'view.rulers.visible': true,
      'view.symmetry.on': true,
      'view.symmetry.axis': 'both',
      'view.pathEditing.comb': true,
      'view.pathEditing.fillets': true,
    });
  });
});

describe('dropSymmetrySwitch', () => {
  it('drops the stored symmetry switch and keeps the axis', () => {
    const records = new Map<string, unknown>([['view.symmetry.on', true], ['view.symmetry.axis', 'both']]);
    dropSymmetrySwitch(records as never);
    expect(Object.fromEntries(records)).toEqual({ 'view.symmetry.axis': 'both' });
  });
});
