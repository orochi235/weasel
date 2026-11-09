import { describe, expect, it } from 'vitest';
import { cssColorLiteral } from '@weasel-js/paint';
import type { LabPreset } from './presets';
import { initialSnapshot, type LabEffect } from './snapshot';
import {
  addEffect, basePatch, effectSpecs, linkPatch, padPatch, presetPatch, resetPatch, setEffectParam, setEffects, setEffectType,
} from './transitions';

const effect = (id: number, type: LabEffect['type'] = 'shadow', more: Partial<LabEffect> = {}): LabEffect => ({
  id, type, name: type === 'shadow' ? 'Shadow' : 'Bevel', on: true, params: {}, ...more,
});

describe('initialSnapshot', () => {
  const args = { look: 'high', variant: 'solid', label: 'COMPOSE' } as const;

  it('opens on the rounded rect at its control defaults, with the story args', () => {
    const snap = initialSnapshot({}, args);
    expect(snap.base).toBe('rounded-rect');
    expect(snap.baseParams).toEqual({ erosion: 0.16, eccentricity: 1, pinch: 0 });
    expect(snap).toMatchObject({
      labEffects: [], nextId: 1, look: 'high', variant: 'solid', label: 'COMPOSE', tint: '#7fb069',
      bloat: 0, size: 'sm', crawlOn: false, crawlSpeed: 0.2, labelX: 0, labelY: 0, zoom: 2,
      padTop: 1, padRight: 6, padBottom: 1, padLeft: 6, fontFamily: 'inherit', fontSizeDelta: 0,
      bold: false, italic: false, caps: 'normal', linkPadX: true, linkPadY: true,
    });
  });

  it('prefers what was saved, and takes a saved base at its own defaults', () => {
    const snap = initialSnapshot({ base: 'chamfered-rect', look: 'warn', zoom: 4, linkPadX: false }, args);
    expect(snap.baseParams).toEqual({ chamfer: 6 });
    expect(snap).toMatchObject({ look: 'warn', zoom: 4, linkPadX: false, variant: 'solid' });
  });

  it('loads effects saved before names and switches as on, named for their type', () => {
    const saved = JSON.parse('{"labEffects":[{"id":3,"type":"bevel2","params":{"bevelWidth":4}},{"id":4,"type":"shadow","name":"Drop","on":false,"params":{}}],"nextId":5}');
    expect(initialSnapshot(saved, args).labEffects).toEqual([
      { id: 3, type: 'bevel2', name: 'Bevel 2', on: true, params: { bevelWidth: 4 } },
      { id: 4, type: 'shadow', name: 'Drop', on: false, params: {} },
    ]);
  });
});

describe('padding', () => {
  it('carries the opposite side while its axis is linked', () => {
    const linked = { linkPadX: true, linkPadY: true };
    expect(padPatch(linked, 'top', 4)).toEqual({ padTop: 4, padBottom: 4 });
    expect(padPatch(linked, 'bottom', 4)).toEqual({ padTop: 4, padBottom: 4 });
    expect(padPatch(linked, 'left', 4)).toEqual({ padLeft: 4, padRight: 4 });
    expect(padPatch(linked, 'right', 4)).toEqual({ padLeft: 4, padRight: 4 });
  });

  it('moves one side alone while its axis is unlinked', () => {
    const free = { linkPadX: false, linkPadY: false };
    expect(padPatch(free, 'top', 4)).toEqual({ padTop: 4 });
    expect(padPatch(free, 'right', 4)).toEqual({ padRight: 4 });
  });

  it('copies left onto right, or top onto bottom, when an axis is linked', () => {
    const pad = { padTop: 2, padLeft: 9 };
    expect(linkPatch(pad, 'x', true)).toEqual({ linkPadX: true, padRight: 9 });
    expect(linkPatch(pad, 'y', true)).toEqual({ linkPadY: true, padBottom: 2 });
    expect(linkPatch(pad, 'x', false)).toEqual({ linkPadX: false });
    expect(linkPatch(pad, 'y', false)).toEqual({ linkPadY: false });
  });
});

describe('base and presets', () => {
  it('picks a base at its control defaults', () => {
    expect(basePatch('chamfered-rect')).toEqual({ base: 'chamfered-rect', baseParams: { chamfer: 6 } });
  });

  it('resets to a bare rounded rect', () => {
    expect(resetPatch()).toEqual({
      base: 'rounded-rect',
      baseParams: { erosion: 0.16, eccentricity: 1, pinch: 0 },
      labEffects: [],
    });
  });

  it('loads a preset over the defaults, numbering its effects from the next free id', () => {
    const preset: LabPreset = {
      name: 'test',
      base: 'chamfered-rect',
      baseParams: { chamfer: 8 },
      effects: [{ type: 'bites', params: { biteRadius: 2 } }, { type: 'bevel', params: {} }],
    };
    expect(presetPatch(preset, 4)).toEqual({
      base: 'chamfered-rect',
      baseParams: { chamfer: 8 },
      labEffects: [
        { id: 4, type: 'bites', name: 'Bites', on: true, params: { biteRadius: 2, biteSpacing: 8, irregularity: 0 } },
        { id: 5, type: 'bevel', name: 'Bevel', on: true, params: { bevelWidth: 6, lightFrom: 'tl' } },
      ],
      nextId: 6,
    });
  });
});

describe('effects', () => {
  it('appends an effect at its defaults, named for its type, and spends an id', () => {
    expect(addEffect({ labEffects: [effect(1)], nextId: 3 }, 'shadow')).toEqual({
      labEffects: [effect(1), effect(3, 'shadow', { params: { dx: 1, dy: 2, opacity: 0.28 } })],
      nextId: 4,
    });
  });

  it('edits one effect by id', () => {
    const list = [effect(1), effect(2)];
    expect(setEffectParam(list, 2, 'dx', 3)).toEqual([effect(1), effect(2, 'shadow', { params: { dx: 3 } })]);
  });

  it('retypes an effect at its new defaults, its name following the type unless it was renamed', () => {
    const list = [effect(1), effect(2, 'shadow', { name: 'Drop' })];
    const next = setEffectType(setEffectType(list, 1, 'bevel'), 2, 'bevel');
    expect(next).toEqual([
      { id: 1, type: 'bevel', name: 'Bevel', on: true, params: { bevelWidth: 6, lightFrom: 'tl' } },
      { id: 2, type: 'bevel', name: 'Drop', on: true, params: { bevelWidth: 6, lightFrom: 'tl' } },
    ]);
  });

  it('takes the list back with nextId past every id, so a duplicate spends the id it was given', () => {
    expect(setEffects({ nextId: 3 }, [effect(1), effect(3), effect(2)])).toEqual({
      labEffects: [effect(1), effect(3), effect(2)],
      nextId: 4,
    });
    expect(setEffects({ nextId: 7 }, [effect(1)]).nextId).toBe(7);
  });

  it('leaves an effect that is off out of the badge', () => {
    const specs = effectSpecs([effect(1), effect(2, 'bevel', { on: false }), effect(3, 'shadow', { params: { dx: 2 } })]);
    expect(specs).toEqual([{ type: 'shadow', params: {} }, { type: 'shadow', params: { dx: 2 } }]);
  });

  it('turns a color control into a color literal for the badge and passes the rest through', () => {
    const specs = effectSpecs([effect(1, 'outline', { params: { width: 2, color: '#ff0000', dash: '' } })]);
    expect(specs).toEqual([{ type: 'outline', params: { width: 2, color: cssColorLiteral('#ff0000'), dash: '' } }]);
  });
});
