import { describe, expect, it } from 'vitest';
import { describePresets, isAtom } from './describePresets';
import { presetToolIds, type FeaturePreset } from './features';
import { FEATURE_PRESETS } from './namedPresets';

const core = describePresets({ '@weasel-js/core': Object.values(FEATURE_PRESETS) });
const of = (id: string) => core.find((d) => d.id === id)!;

describe('describePresets', () => {
  it('describes every core preset once, each after the presets it includes', () => {
    expect(core.map((d) => d.id).sort()).toEqual(Object.keys(FEATURE_PRESETS).sort());
    const at = new Map(core.map((d, i) => [d.id, i]));
    for (const d of core) for (const inner of d.includes) expect(at.get(inner)!, `${inner} before ${d.id}`).toBeLessThan(at.get(d.id)!);
  });

  it("gives back each preset's own actions, tools, and includes by id", () => {
    for (const [id, preset] of Object.entries(FEATURE_PRESETS)) {
      const d = of(id);
      expect(d.actions, id).toEqual((preset.actions ?? []).map((a) => a.id));
      expect(d.tools, id).toEqual(presetToolIds(preset));
      expect(d.includes, id).toEqual((preset.includes ?? []).map((p) => p.id));
      expect(d.package).toBe('@weasel-js/core');
    }
  });

  it('marks the presets with a code role as atoms, and only those', () => {
    const atoms = core.filter((d) => d.atom).map((d) => d.id).sort();
    expect(atoms).toEqual(['anchorKeys', 'move', 'outline', 'resize', 'rotate']);
  });

  it('reads a label, or the id where there is none', () => {
    expect(of('edit').label).toBe('Edit');
    expect(describePresets({ pkg: [{ id: 'bare' }] })[0]!.label).toBe('bare');
  });

  it('lists a tool of its own by id and makes its preset an atom', () => {
    const own = { id: 'stamp' } as unknown as NonNullable<FeaturePreset['tools']>[number];
    const preset: FeaturePreset = { id: 'stamping', tools: ['rect', own] };
    expect(isAtom(preset)).toBe(true);
    expect(describePresets({ pkg: [preset] })[0]!.tools).toEqual(['rect', 'stamp']);
  });

  it('files a preset reached from two packages under the first', () => {
    const shared: FeaturePreset = { id: 'shared' };
    const out = describePresets({ a: [{ id: 'one', includes: [shared] }], b: [shared] });
    expect(out.filter((d) => d.id === 'shared').map((d) => d.package)).toEqual(['a']);
  });
});
