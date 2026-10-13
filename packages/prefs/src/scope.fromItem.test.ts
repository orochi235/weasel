import { describe, expect, it } from 'vitest';
import type { PrefGroup } from './groups';
import { prefValueAtPath } from './helpers';
import type { PrefList } from './list';
import type { PrefLeaf, PrefObject } from './schema';
import { applyPrefConditions, applyPrefEntryConditions, prefJudge, prefScopeAt } from './scope';

const num = (name: string, extra: Partial<PrefLeaf> = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, ...extra }) as PrefLeaf;
const flag = (name: string, extra: Partial<PrefLeaf> = {}): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: false, ...extra }) as PrefLeaf;
const mode = { kind: 'enum', name: 'Mode', description: '', default: 'ease', options: [{ value: 'ease', label: 'Ease' }, { value: 'hold', label: 'Hold' }] } as PrefLeaf;
const object = (name: string, children: Record<string, PrefLeaf>, extra: Partial<PrefLeaf> = {}): PrefLeaf =>
  ({ kind: 'object', name, description: '', default: {}, children, ...extra }) as PrefLeaf;
const list = (name: string, item: PrefLeaf, extra: Partial<PrefLeaf> = {}): PrefLeaf =>
  ({ kind: 'list', name, description: '', default: [], item, ...extra }) as PrefLeaf;

const isHold = { from: 'item', path: 'mode', is: 'hold' } as const;
const step = object('Step', {
  on: flag('On'),
  size: num('Size', { showIf: { from: 'item', path: 'on' } }),
  outer: num('Outer', { enableIf: isHold }),
});
const phase = object('Phase', {
  mode,
  hold: num('Hold', { showIf: isHold }),
  gain: num('Gain', { enableIf: { all: [isHold, { path: 'open' }] } }),
  ease: num('Ease', { showIf: { path: 'eased' } }),
  steps: list('Steps', step, { enableIf: isHold }),
}, { enableIf: { from: 'item', path: 'locked', isNot: true } });
const schema: PrefGroup = {
  name: '',
  children: { mode: flag('Mode'), open: flag('Open'), eased: flag('Eased'), phases: list('Phases', phase) },
};
const ROOT = { mode: true, open: true, eased: true };
const read = (values: unknown) => (path: string) => prefValueAtPath(values, path);
const fields = (leaf: PrefLeaf): string[] => Object.keys((leaf as PrefObject).children);

describe('a condition that reads the entry, with no entry to read', () => {
  it('is left unanswered by the schema-wide pass, which keeps and enables what it would decide', () => {
    const applied = applyPrefConditions(schema, prefJudge(schema, read(ROOT)));
    expect(applied.shown).toBe(schema);
    expect([...applied.disabled]).toEqual([]);
    expect(prefScopeAt(schema, 'phases.0.hold', prefJudge(schema, read(ROOT)))).toEqual({ shown: true, enabled: true });
  });

  it('still applies what reads the root, beside it', () => {
    const applied = applyPrefConditions(schema, prefJudge(schema, read({ ...ROOT, eased: false })));
    expect(fields((applied.shown!.children.phases as PrefList).item)).toEqual(['mode', 'hold', 'gain', 'steps']);
  });
});

describe('applyPrefEntryConditions', () => {
  const entryOf = (value: unknown, root: unknown = ROOT, item: PrefLeaf = phase, path = 'phases.1', keepHidden = false) =>
    applyPrefEntryConditions(item, path, prefJudge(schema, read(root), { item, value }), { keepHidden });

  it('reads the entry it is given, not the root pref of the same name', () => {
    const eased = entryOf({ mode: 'ease' });
    expect(fields(eased.item)).toEqual(['mode', 'gain', 'ease', 'steps']);
    expect([...eased.disabled]).toEqual(['phases.1.gain', 'phases.1.steps', 'phases.1.steps.*', 'phases.1.steps.*.on', 'phases.1.steps.*.size', 'phases.1.steps.*.outer']);
    const held = entryOf({ mode: 'hold' });
    expect(held.item).toBe(phase);
    expect([...held.disabled]).toEqual([]);
  });

  it('reads a field the entry does not hold as the item\'s default for it', () => {
    const withDefault = { ...phase, default: { mode: 'hold' } } as PrefLeaf;
    expect(entryOf({}, ROOT, withDefault).item).toBe(withDefault);
    expect(entryOf(undefined, ROOT, withDefault).item).toBe(withDefault);
    expect(fields(entryOf({}).item)).not.toContain('hold');
  });

  it('answers a condition that reads both the entry and the root', () => {
    expect(entryOf({ mode: 'hold' }, { ...ROOT, open: false }).disabled.has('phases.1.gain')).toBe(true);
  });

  it("answers the item's own enableIf for the entry, and disables everything in it", () => {
    const locked = entryOf({ mode: 'hold', locked: true });
    expect(locked.disabled.has('phases.1')).toBe(true);
    expect(locked.disabled.has('phases.1.mode')).toBe(true);
  });

  it('leaves a list inside the entry for its own entries, where from is the nearest one', () => {
    const outer = entryOf({ mode: 'hold', steps: [{ on: false }] });
    expect(fields(((outer.item as PrefObject).children.steps as PrefList).item)).toEqual(['on', 'size', 'outer']);
    const inner = (value: unknown) => entryOf(value, ROOT, step, 'phases.1.steps.0');
    expect(fields(inner({ on: false }).item)).toEqual(['on', 'outer']);
    expect(fields(inner({ on: true }).item)).toEqual(['on', 'size', 'outer']);
    // `mode` is the outer entry's, which an inner field cannot read.
    expect(inner({ on: true }).disabled.has('phases.1.steps.0.outer')).toBe(true);
    expect(inner({ on: true, mode: 'hold' }).disabled.has('phases.1.steps.0.outer')).toBe(false);
  });

  it('keeps and names what it hides where hidden nodes are kept', () => {
    const kept = entryOf({ mode: 'ease' }, ROOT, phase, 'phases.1', true);
    expect(kept.item).toBe(phase);
    expect([...kept.hidden]).toEqual(['phases.1.hold']);
  });

  it('compares a field of the entry as its control shows it', () => {
    const italic = flag('Italic', { encoding: { read: (stored: unknown) => stored === 'italic', write: (on: boolean) => (on ? 'italic' : undefined) } } as Partial<PrefLeaf>);
    const run = object('Run', { italic, slant: num('Slant', { showIf: { from: 'item', path: 'italic', is: true } }) });
    expect(fields(entryOf({ italic: 'italic' }, ROOT, run, 'runs.0').item)).toEqual(['italic', 'slant']);
    expect(fields(entryOf({ italic: 'normal' }, ROOT, run, 'runs.0').item)).toEqual(['italic']);
  });

  it('reads the entry itself at the empty path', () => {
    const count = num('Count', { enableIf: { from: 'item', path: '', above: 0 } });
    expect(entryOf(0, ROOT, count, 'counts.0').disabled.has('counts.0')).toBe(true);
    expect(entryOf(2, ROOT, count, 'counts.0').disabled.has('counts.0')).toBe(false);
  });
});
