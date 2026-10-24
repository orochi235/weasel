import { describe, expect, it } from 'vitest';
import { cssColorLiteral } from '@weasel-js/paint';
import type { LabPreset } from './presets';
import { initialSnapshot, type LabEffect } from './snapshot';
import {
  addEffect, basePatch, effectSpecs, linkPatch, moveEffectToGap, padPatch, presetPatch, removeEffect, resetPatch,
  setEffectParam, setEffectType,
} from './transitions';

const effect = (id: number, type: LabEffect['type'] = 'shadow'): LabEffect => ({ id, type, params: {} });
const ids = (effects: LabEffect[]): number[] => effects.map((e) => e.id);

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
        { id: 4, type: 'bites', params: { biteRadius: 2, biteSpacing: 8, irregularity: 0 } },
        { id: 5, type: 'bevel', params: { bevelWidth: 6, lightFrom: 'tl' } },
      ],
      nextId: 6,
    });
  });
});

describe('effects', () => {
  it('appends an effect at its defaults and spends an id', () => {
    expect(addEffect({ labEffects: [effect(1)], nextId: 3 }, 'shadow')).toEqual({
      labEffects: [effect(1), { id: 3, type: 'shadow', params: { dx: 1, dy: 2, opacity: 0.28 } }],
      nextId: 4,
    });
  });

  it('removes, edits, and retypes one effect by id', () => {
    const list = [effect(1), effect(2)];
    expect(ids(removeEffect(list, 1))).toEqual([2]);
    expect(setEffectParam(list, 2, 'dx', 3)).toEqual([effect(1), { id: 2, type: 'shadow', params: { dx: 3 } }]);
    expect(setEffectType(list, 1, 'bevel')).toEqual([
      { id: 1, type: 'bevel', params: { bevelWidth: 6, lightFrom: 'tl' } },
      effect(2),
    ]);
  });

  it('moves an effect to a gap counted before the move', () => {
    const list = [effect(1), effect(2), effect(3)];
    expect(ids(moveEffectToGap(list, 1, 3))).toEqual([2, 3, 1]);
    expect(ids(moveEffectToGap(list, 3, 0))).toEqual([3, 1, 2]);
    expect(ids(moveEffectToGap(list, 1, 2))).toEqual([2, 1, 3]);
  });

  it('leaves the order alone for either gap beside the effect, or an unknown id', () => {
    const list = [effect(1), effect(2), effect(3)];
    expect(ids(moveEffectToGap(list, 2, 1))).toEqual([1, 2, 3]);
    expect(ids(moveEffectToGap(list, 2, 2))).toEqual([1, 2, 3]);
    expect(ids(moveEffectToGap(list, 9, 0))).toEqual([1, 2, 3]);
  });

  it('turns a color control into a color literal for the badge and passes the rest through', () => {
    const specs = effectSpecs([{ id: 1, type: 'outline', params: { width: 2, color: '#ff0000', dash: '' } }]);
    expect(specs).toEqual([{ type: 'outline', params: { width: 2, color: cssColorLiteral('#ff0000'), dash: '' } }]);
  });
});
