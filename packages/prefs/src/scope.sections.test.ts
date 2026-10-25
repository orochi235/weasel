import { describe, expect, it } from 'vitest';
import type { PrefSection } from './groups';
import { prefValueAtPath } from './helpers';
import type { PrefLeaf } from './schema';
import { applyPrefConditions, applyPrefEntryConditions, prefJudge, prefSectionPath } from './scope';

const bool = (name: string, extra: Partial<PrefLeaf> = {}): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: false, ...extra }) as PrefLeaf;
const num = (name: string): PrefLeaf => ({ kind: 'number', name, description: '', default: 0 }) as PrefLeaf;

const over = (values: unknown) => prefJudge({ name: '', children: {} }, (path) => prefValueAtPath(values, path));

describe('a section its enableIf turns off', () => {
  const schema: PrefSection = {
    name: 'Root',
    members: {
      look: {
        name: 'Look',
        enableIf: { path: 'lit' },
        members: { lit: bool('Lit', { heading: true }), gain: num('Gain'), more: { name: 'More', members: { tone: num('Tone') } } },
      },
      other: { name: 'Other', members: { more: { name: 'More', members: { hue: num('Hue') } } } },
      stroke: {
        kind: 'object',
        name: 'Stroke',
        description: '',
        default: {},
        children: { edge: { name: 'Edge', enableIf: { path: 'stroke.on' }, members: { on: bool('On'), width: num('Width') } } },
      } as PrefLeaf,
    },
  };

  it('is named in `disabled` by its section path, a nested one under the section holding it, and its switch leaf stays live', () => {
    const { disabled } = applyPrefConditions(schema, over({ lit: false, stroke: { on: false } }));
    const look = prefSectionPath('', 'look');
    expect([...disabled].sort()).toEqual(
      [look, prefSectionPath(look, 'more'), prefSectionPath('stroke', 'edge'), 'gain', 'stroke.width', 'tone'].sort(),
    );
    // Two sections keyed alike under different sections have different paths.
    expect(prefSectionPath(look, 'more')).not.toBe(prefSectionPath(prefSectionPath('', 'other'), 'more'));
  });

  it('names no section while its condition holds', () => {
    const { disabled } = applyPrefConditions(schema, over({ lit: true, stroke: { on: true } }));
    expect([...disabled]).toEqual([]);
  });

  it('cannot collide with a value path', () => {
    expect(prefSectionPath('stroke', 'edge')).not.toBe('stroke.edge');
    expect(prefSectionPath('', 'look')).not.toBe('look');
  });

  it("is named under an entry's path where the condition reads the entry", () => {
    const item = {
      kind: 'object',
      name: 'Phase',
      description: '',
      default: {},
      children: { timing: { name: 'Timing', enableIf: { path: 'on', from: 'item' }, members: { on: bool('On'), hold: num('Hold') } } },
    } as PrefLeaf;
    const judge = prefJudge({ name: '', children: {} }, () => undefined, { item, value: { on: false } });
    const { disabled } = applyPrefEntryConditions(item, 'phases.2', judge);
    expect(disabled.has(prefSectionPath('phases.2', 'timing'))).toBe(true);
    expect(disabled.has('phases.2.hold')).toBe(true);
  });
});
