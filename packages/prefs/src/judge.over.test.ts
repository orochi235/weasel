import { describe, expect, it } from 'vitest';
import { checkPrefCondition, checkPrefConditions } from './conditionCheck';
import type { PrefGroup, PrefSection } from './groups';
import { prefSchemaHolding } from './holding';
import { prefJudge, prefReader } from './judge';
import type { PrefBooleanEncoding, PrefLeaf } from './schema';

const flag = (name: string, extra: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: false, ...extra }) as PrefLeaf;
const italic: PrefBooleanEncoding = { read: (stored) => stored === 'italic', write: (on) => (on ? 'italic' : 'normal') };

// The schema the settings live in.
const over: PrefGroup = {
  name: 'Dialog',
  children: {
    on: flag('On', { default: true }),
    both: flag('Both', { default: true }),
    text: {
      name: 'Text',
      children: {
        slant: flag('Italic', { default: 'normal', encoding: italic }),
        face: { kind: 'object', name: 'Face', description: '', default: { bold: true }, children: { bold: flag('Bold') } } as PrefLeaf,
      },
    },
  },
};
// A schema drawn over it, whose conditions name its settings.
const own: PrefGroup = {
  name: 'Panel',
  children: {
    both: flag('Both', { default: false }),
    rows: { name: 'Rows', showIf: { path: 'on' }, enableIf: { path: 'text.slant' }, children: { tight: flag('Tight') } },
  },
};

const judged = (second: PrefGroup | PrefSection | undefined) => (path: string, values: unknown): boolean =>
  prefJudge(own, prefReader(own, values, second), undefined, second)({ path }, 'showIf');
const holds = judged(over);
const alone = judged(undefined);

describe('which schema answers for a path', () => {
  it('is the first where a leaf of it holds the path, a field of an object leaf included, and else the second', () => {
    expect(prefSchemaHolding(own, 'both', over)).toBe(own);
    expect(prefSchemaHolding(own, 'rows.tight', over)).toBe(own);
    expect(prefSchemaHolding(own, 'on', over)).toBe(over);
    expect(prefSchemaHolding(own, 'text.face.bold', over)).toBe(over);
    expect(prefSchemaHolding(own, 'nowhere', over)).toBe(over);
    expect(prefSchemaHolding(own, 'on')).toBe(own);
  });
});

describe('a condition that reads a pref of the schema a form is drawn over', () => {
  it('reads that pref\'s default where the values hold nothing, which with no second schema is unset', () => {
    expect(holds('on', {})).toBe(true);
    expect(alone('on', {})).toBe(false);
    expect(holds('on', { on: false })).toBe(false);
  });

  it('reads the part of an object leaf\'s default the path names', () => {
    expect(holds('text.face.bold', {})).toBe(true);
  });

  it('compares the value as that pref\'s control shows it', () => {
    expect(holds('text.slant', {})).toBe(false);
    expect(holds('text.slant', { text: { slant: 'italic' } })).toBe(true);
    // Stored as it is, the string is a value, which a bare test takes as set.
    expect(alone('text.slant', { text: { slant: 'normal' } })).toBe(true);
    expect(holds('text.slant', { text: { slant: 'normal' } })).toBe(false);
  });

  it('reads the form\'s own leaf at a path both schemas hold', () => {
    expect(holds('both', {})).toBe(false);
  });
});

describe('checking a condition against the schema a form is drawn over', () => {
  it('reports a path neither schema holds, and not one the second does', () => {
    expect(checkPrefCondition({ path: 'on' }, own).map((p) => p.code)).toEqual(['no-leaf']);
    expect(checkPrefCondition({ path: 'on' }, own, {}, over)).toEqual([]);
    expect(checkPrefCondition({ path: 'nowhere' }, own, {}, over).map((p) => p.code)).toEqual(['no-leaf']);
  });

  it('holds a comparison to the leaf that answers for the path', () => {
    expect(checkPrefCondition({ path: 'on', is: 'yes' }, own, {}, over).map((p) => p.code)).toEqual(['value']);
    expect(checkPrefCondition({ path: 'both', is: true }, own, {}, over)).toEqual([]);
  });

  it('checks every condition of a schema that way', () => {
    expect(checkPrefConditions(own).map((p) => [p.at, p.field, p.code])).toEqual([
      ['rows', 'showIf', 'no-leaf'],
      ['rows', 'enableIf', 'no-leaf'],
    ]);
    expect(checkPrefConditions(own, over)).toEqual([]);
  });
});
