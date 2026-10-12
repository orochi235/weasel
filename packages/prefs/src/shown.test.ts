import { describe, expect, it } from 'vitest';
import { checkPrefCondition } from './conditionCheck';
import type { PrefGroup, PrefSection } from './groups';
import { prefValueAtPath } from './helpers';
import type { PrefLeaf } from './schema';
import { prefJudge } from './scope';
import { prefShownReader } from './shown';

const italic = { read: (stored: unknown) => stored === 'italic', write: (on: boolean) => (on ? 'italic' : undefined) };
/** A dash array read as a style: lengths equal to the stroke's width are dots. */
const dash = {
  read: (stored: unknown, siblings: Record<string, unknown> | undefined) =>
    !Array.isArray(stored) || stored.length === 0 ? 'solid' : stored[0] === siblings?.width ? 'dotted' : 'dashed',
  write: () => undefined,
};
const options = ['solid', 'dashed', 'dotted'].map((value) => ({ value, label: value }));

const slant = { kind: 'boolean', name: 'Italic', description: '', default: false, encoding: italic } as PrefLeaf;
const stroke = {
  kind: 'object', name: 'Stroke', description: '', default: { width: 1 },
  children: {
    width: { kind: 'number', name: 'Width', description: '', default: 1 },
    line: { name: 'Line', members: { dash: { kind: 'enum', name: 'Style', description: '', default: 'solid', options, encoding: dash } } },
  },
} as PrefLeaf;

const group: PrefGroup = { name: '', children: { text: { name: 'Text', children: { slant } }, stroke, plain: { kind: 'string', name: 'Plain', description: '', default: '' } } };
const section: PrefSection = { name: '', members: { look: { name: 'Look', members: { 'data.slant': slant, 'data.stroke': stroke } } } };

const over = (schema: PrefGroup | PrefSection, values: unknown) => prefJudge(schema, (path) => prefValueAtPath(values, path));

describe('prefShownReader', () => {
  it('hands back what an encoded leaf reads as, and anything else as it is stored', () => {
    const read = prefShownReader(group, (path) => prefValueAtPath({ text: { slant: 'italic' }, plain: 'italic' }, path));
    expect(read('text.slant')).toBe(true);
    expect(read('plain')).toBe('italic');
    expect(read('nowhere')).toBeUndefined();
  });

  it('reads a field of an object leaf against the object it is a field of', () => {
    const read = prefShownReader(group, (path) => prefValueAtPath({ stroke: { width: 3, dash: [3, 3] } }, path));
    expect(read('stroke.dash')).toBe('dotted');
    expect(read('stroke.width')).toBe(3);
  });
});

describe('prefJudge', () => {
  it('takes a boolean stored through an encoding as on or off', () => {
    expect(over(group, { text: { slant: 'italic' } })({ path: 'text.slant' }, 'showIf')).toBe(true);
    expect(over(group, { text: { slant: 'italic' } })({ path: 'text.slant', is: true }, 'showIf')).toBe(true);
    expect(over(group, { text: { slant: 'normal' } })({ path: 'text.slant' }, 'showIf')).toBe(false);
    expect(over(group, {})({ path: 'text.slant', is: false }, 'enableIf')).toBe(true);
  });

  it('takes an enum stored through an encoding as the option it reads as', () => {
    expect(over(group, { stroke: { width: 2, dash: [6, 2] } })({ path: 'stroke.dash', is: 'dashed' }, 'showIf')).toBe(true);
    expect(over(group, { stroke: { width: 2 } })({ path: 'stroke.dash', in: ['dashed', 'dotted'] }, 'showIf')).toBe(false);
  });

  it('decodes under a section schema, where a key is the whole path', () => {
    const judge = over(section, { data: { slant: 'italic', stroke: { width: 4, dash: [4, 4] } } });
    expect(judge({ path: 'data.slant', is: true }, 'showIf')).toBe(true);
    expect(judge({ path: 'data.stroke.dash', is: 'dotted' }, 'showIf')).toBe(true);
  });
});

describe('checkPrefCondition against an encoded leaf', () => {
  it('rules out a stored form, which the condition never sees', () => {
    expect(checkPrefCondition({ path: 'text.slant', is: 'italic' }, group).map((p) => p.code)).toEqual(['value']);
    expect(checkPrefCondition({ path: 'stroke.dash', in: ['dashed', 'wavy'] }, group).map((p) => p.problem)).toEqual([
      `"stroke.dash" never holds 'wavy': its options are 'solid', 'dashed', 'dotted'`,
    ]);
  });

  it('accepts what the leaf reads as, and nothing held', () => {
    expect(checkPrefCondition({ path: 'text.slant', is: true }, group)).toEqual([]);
    expect(checkPrefCondition({ any: [{ path: 'stroke.dash', is: 'dotted' }, { path: 'stroke.dash', is: null }] }, group)).toEqual([]);
  });
});
