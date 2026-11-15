/** How presets' node-kind traits merge with the consumer's own: `nodeTraitsOf`'s precedence. */
import { describe, expect, it } from 'vitest';
import type { NodeRoutingEntry } from 'core/scene/NodeRouting';
import { inferredNodeRouting } from './defaultNodeRouting';
import { inferredNodeProperties } from './defaultNodeProperties';
import { nodeKindPreset, nodeTraitsOf } from './nodeTraits';
import type { FeaturePreset } from './features';
import { insertsNothing } from './toolRegistry';
import type { Tool } from 'tools/overlayBinding';

const isGem = (d: unknown) => typeof d === 'object' && d !== null && 'gem' in d;
const gemFactory = () => ({ data: { gem: {} } });
const gem = nodeKindPreset({ id: 'gem', kind: 'gem', matches: isGem, insert: gemFactory, properties: { schema: { name: 'P', members: {} } } });
const names = (entries: readonly { name: string }[]) => entries.map((e) => e.name);

describe('nodeTraitsOf', () => {
  it('puts presets ahead of the defaults when the consumer gives none', () => {
    const t = nodeTraitsOf([gem]);
    expect(names(t.routing)).toEqual(['gem', ...names(inferredNodeRouting)]);
    expect(names(t.properties)).toEqual(['gem', ...names(inferredNodeProperties)]);
    expect(t.insertNodeFactories).toEqual({ gem: gemFactory });
  });

  it("keeps the consumer's entry for a name both give, and the consumer's list in place of the defaults", () => {
    const mine: NodeRoutingEntry = { name: 'gem', matches: () => false };
    const other: NodeRoutingEntry = { name: 'other', matches: () => false };
    expect(nodeTraitsOf([gem], { routing: [other, mine] }).routing).toEqual([other, mine]);
    expect(nodeTraitsOf([gem], { routing: [] }).routing.map((e) => e.name)).toEqual(['gem']);
  });

  it("replaces a default of the preset's name when the consumer gives no list", () => {
    const text = nodeKindPreset({ id: 'my-text', kind: 'text', matches: () => false });
    const routing = nodeTraitsOf([text]).routing;
    expect(routing.filter((e) => e.name === 'text')).toEqual(text.routing);
  });

  it("lets the consumer's factory win a kind, and skips one given as undefined", () => {
    const mine = () => null;
    expect(nodeTraitsOf([gem], { insertNodeFactories: { gem: mine } }).insertNodeFactories!.gem).toBe(mine);
    expect(nodeTraitsOf([gem], { insertNodeFactories: { gem: undefined } }).insertNodeFactories!.gem).toBe(gemFactory);
  });

  it('counts one value two presets share once, an included preset once, and throws on a different value', () => {
    const again = nodeKindPreset({ id: 'gem-again', kind: 'gem', matches: isGem, insert: gemFactory });
    const bundle: FeaturePreset = { id: 'bundle', includes: [gem] };
    expect(names(nodeTraitsOf([gem, again, bundle]).routing).filter((n) => n === 'gem')).toHaveLength(1);
    const clash = nodeKindPreset({ id: 'clash', kind: 'gem', matches: isGem, insert: () => null });
    expect(() => nodeTraitsOf([gem, clash])).toThrow('presets "gem" and "clash" both give insert factory "gem"');
  });

  it('lists each painter once, in preset order', () => {
    const painter = { id: 'p', matches: () => false, paint: () => [] };
    const a: FeaturePreset = { id: 'a', shapes: [painter] };
    const b: FeaturePreset = { id: 'b', shapes: [{ painter, priority: 'high' }] };
    expect(nodeTraitsOf([a, b]).shapes).toEqual([{ painter }]);
  });
});

describe('insertsNothing', () => {
  const tool = (params: unknown): Tool => ({ id: 't', bindings: [{ spec: { kind: 'drag' }, actionId: 'insert', opts: { params } }] }) as unknown as Tool;
  const builds = (k: string) => k === 'rect';
  it('is true only when every insert binding names a kind nothing builds', () => {
    expect(insertsNothing(tool({ kind: 'gem' }), builds)).toBe(true);
    expect(insertsNothing(tool({ kind: 'rect' }), builds)).toBe(false);
    expect(insertsNothing(tool(() => ({ kind: 'gem' })), builds)).toBe(false);
    expect(insertsNothing({ id: 'hand', bindings: [] } as unknown as Tool, builds)).toBe(false);
  });
});
