import { isPrefLeaf, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { f } from './builder';
import { resolveConfigSchema } from './resolve';
import { sectionTree } from './sectionTree';

const nodeAt = (g: PrefGroup, railPath: string): PrefGroup | PrefLeaf => {
  let node: PrefGroup | PrefLeaf = g;
  for (const key of railPath.split('.')) {
    if (isPrefLeaf(node) || !node.children[key]) throw new Error(`nothing at ${railPath}`);
    node = node.children[key];
  }
  return node;
};

describe('sectionTree enableIf', () => {
  const orbs = resolveConfigSchema(
    f.schema({
      orbs: f
        .group({
          commitOrbs: f.boolean(true),
          fanDown: f.number(3).enableIf({ path: 'orbs.commitOrbs', is: true }),
        })
        .section('Change'),
    }),
  );

  it('judges a condition by path against the config, across the section it was renested under', () => {
    const on = sectionTree(orbs, { orbs: { commitOrbs: true, fanDown: 3 } });
    expect([...on.disabled]).toEqual([]);
    const off = sectionTree(orbs, { orbs: { commitOrbs: false, fanDown: 3 } });
    expect([...off.disabled]).toEqual(['change.orbs.fanDown']);
  });

  it('leaves no condition in the tree for the form to misread against the renested values', () => {
    const { group } = sectionTree(orbs, { orbs: { commitOrbs: false, fanDown: 3 } });
    expect(nodeAt(group, 'change.orbs.fanDown')).not.toHaveProperty('enableIf');
  });

  it('asks an enableIf written as a function', () => {
    const resolved = resolveConfigSchema(
      f.schema({
        order: f.enum<string>('time', ['time', 'queue']).section('Change'),
        overlap: f
          .number(1)
          .section('Change')
          .enableIf((c) => c.order !== 'queue'),
      }),
    );
    expect([...sectionTree(resolved, { order: 'time', overlap: 1 }).disabled]).toEqual([]);
    expect([...sectionTree(resolved, { order: 'queue', overlap: 1 }).disabled]).toEqual([
      'change.overlap',
    ]);
  });

  it("disables a group's leaves with it, and leaves the switch it reads live", () => {
    const resolved = resolveConfigSchema(
      f.schema({
        listing: f
          .group({
            on: f.boolean(false),
            dim: f.number(1),
            weight: f.number(0),
          })
          .enableIf({ path: 'listing.on' })
          .section('View'),
      }),
    );
    const off = sectionTree(resolved, { listing: { on: false, dim: 1, weight: 0 } });
    expect([...off.disabled].sort()).toEqual([
      'view.listing',
      'view.listing.dim',
      'view.listing.weight',
    ]);
    expect(nodeAt(off.group, 'view.listing')).not.toHaveProperty('enableIf');
    const on = sectionTree(resolved, { listing: { on: true, dim: 1, weight: 0 } });
    expect([...on.disabled]).toEqual([]);
  });

  it("judges the conditions on an object leaf's fields against the config, and cuts the fields a showIf hides", () => {
    const resolved = resolveConfigSchema(
      f.schema({
        look: f
          .group({
            stroke: f.object({
              on: f.boolean(false),
              width: f.number(1).enableIf({ path: 'look.stroke.on' }),
              cap: f.number(1).showIf({ path: 'look.stroke.on' }),
            }),
          })
          .section('Style'),
      }),
    );
    const off = sectionTree(resolved, { look: { stroke: { on: false, width: 1, cap: 1 } } });
    expect([...off.disabled]).toEqual(['style.look.stroke.width']);
    const stroke = nodeAt(off.group, 'style.look.stroke') as PrefLeaf & { children: Record<string, PrefLeaf> };
    expect(Object.keys(stroke.children)).toEqual(['on', 'width']);
    expect(stroke.children.width).not.toHaveProperty('enableIf');
    const on = sectionTree(resolved, { look: { stroke: { on: true, width: 1, cap: 1 } } });
    expect([...on.disabled]).toEqual([]);
    expect(Object.keys((nodeAt(on.group, 'style.look.stroke') as typeof stroke).children)).toEqual(['on', 'width', 'cap']);
  });

  it("keeps a condition that reads a list's entry for the form, with its other tests answered", () => {
    const resolved = resolveConfigSchema(
      f.schema({
        on: f.boolean(true).section('Phases'),
        phases: f
          .list(
            [],
            f.object({
              mode: f.enum<string>('hold', ['hold', 'fade']),
              hold: f.number(1).enableIf({ all: [{ from: 'item', path: 'mode', is: 'hold' }, { path: 'on' }] }),
            }),
          )
          .section('Phases'),
      }),
    );
    const { group } = sectionTree(resolved, { on: false, phases: [] });
    const item = (nodeAt(group, 'phases.phases') as PrefLeaf & { item: PrefLeaf & { children: Record<string, PrefLeaf> } }).item;
    expect(item.children.hold?.enableIf).toEqual({ all: [{ from: 'item', path: 'mode', is: 'hold' }, { any: [] }] });
  });
});
