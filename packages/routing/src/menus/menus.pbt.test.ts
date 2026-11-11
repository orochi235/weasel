/**
 * Property tests of the menu plumbing: `tidy`'s separators, `withReason` through submenus, `mergeMenuDefs`
 * keeping every child of every live contribution once and in order, and `pickMenu` taking the first match.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { MenuEntry } from '@weasel-js/menu';
import type { PrefGroup } from '@weasel-js/prefs';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { mergeMenuDefs, pickMenu } from './pickMenu';
import { tidy, withReason } from './separators';
import type { MenuDef, MenuHit, MenuWhen, OwnedMenuDef } from './types';

const entry: fc.Arbitrary<MenuEntry> = fc.letrec<{ entry: MenuEntry }>((tie) => ({
  entry: fc.oneof(
    { depthSize: 'small' },
    fc.nat(99).map((n): MenuEntry => ({ kind: 'separator', key: `s${n}` })),
    fc.record({ n: fc.nat(99), disabled: fc.option(fc.boolean(), { nil: undefined }), reason: fc.option(fc.constant('own'), { nil: undefined }) })
      .map(({ n, disabled, reason }): MenuEntry => ({
        kind: 'item', key: `i${n}`, label: `I${n}`, run: () => {},
        ...(disabled !== undefined ? { disabled } : {}), ...(reason !== undefined ? { disabledReason: reason } : {}),
      })),
    fc.record({ n: fc.nat(99), disabled: fc.boolean(), entries: fc.array(tie('entry'), { maxLength: 3 }) })
      .map(({ n, disabled, entries }): MenuEntry => ({ kind: 'submenu', key: `m${n}`, label: `M${n}`, disabled, entries })),
  ),
})).entry;

describe('tidy', () => {
  it('keeps every row in order, with no separator leading, trailing, or doubled, and is idempotent', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(entry, { maxLength: 10 }), (es) => {
      const out = tidy(es);
      expect(out.filter((e) => e.kind !== 'separator')).toEqual(es.filter((e) => e.kind !== 'separator'));
      expect(out[0]?.kind).not.toBe('separator');
      expect(out.at(-1)?.kind).not.toBe('separator');
      out.forEach((e, i) => { if (i > 0 && e.kind === 'separator') expect(out[i - 1]!.kind).not.toBe('separator'); });
      // A separator between two rows survives: one stands wherever the input had one between them.
      const rows = es.flatMap((e, i) => (e.kind === 'separator' ? [] : [i]));
      const kept = out.filter((e) => e.kind === 'separator').length;
      const gaps = rows.slice(1).filter((r, k) => es.slice(rows[k]! + 1, r).some((e) => e.kind === 'separator')).length;
      expect(kept).toBe(gaps);
      if (gaps > 0 && kept < es.filter((e) => e.kind === 'separator').length) t.hit('dropped some');
      expect(tidy(out)).toEqual(out);
    }), runs(300));
    t.expectHit('dropped some');
  }, timeoutFor(300, 1));
});

describe('withReason', () => {
  it('gives the reason to every disabled row lacking one, at any depth, and changes nothing else', () => {
    const t = tally();
    const check = (before: readonly MenuEntry[], after: readonly MenuEntry[]): void => {
      expect(after.length).toBe(before.length);
      before.forEach((b, i) => {
        const a = after[i]!;
        if (b.kind === 'separator') { expect(a).toBe(b); return; }
        const given = b.disabled === true && b.disabledReason === undefined;
        if (given) t.hit('given');
        expect(a.kind !== 'separator' && a.disabledReason).toBe(given ? 'why' : b.disabledReason ?? undefined);
        const { disabledReason: _a, entries: ea, ...restA } = a as MenuEntry & { entries?: MenuEntry[]; disabledReason?: string };
        const { disabledReason: _b, entries: eb, ...restB } = b as MenuEntry & { entries?: MenuEntry[]; disabledReason?: string };
        expect(restA).toEqual(restB);
        if (eb) check(eb, ea!);
      });
    };
    fc.assert(fc.property(fc.array(entry, { maxLength: 6 }), (es) => {
      expect(withReason(es, undefined)).toBe(es);
      check(es, withReason(es, 'why'));
    }), runs(300));
    t.expectHit('given');
  }, timeoutFor(300, 1));
});

const KEYS = ['a', 'b', 'a~1', '~sep1', 'x~2', '__proto__', 'constructor'];
type PrefChild = PrefGroup['children'][string];
const node = (tag: string): PrefChild => ({ kind: 'boolean', name: tag, description: '', default: false }) as unknown as PrefChild;
const BODY = ['empty', 'selected-body', 'unselected-body'] as const;
const when: fc.Arbitrary<MenuWhen | undefined> = fc.option(fc.record({
  bodyTarget: fc.oneof(fc.constantFrom(...BODY), fc.subarray([...BODY])),
  bodyKind: fc.oneof(fc.constantFrom('rect', 'path'), fc.subarray(['rect', 'path'])),
}, { requiredKeys: [] }), { nil: undefined });

let serial = 0;
const ownedDef: fc.Arbitrary<OwnedMenuDef> = fc.record({
  id: fc.constantFrom('m1', 'm2'),
  owner: fc.constantFrom<string | null>(null, 'pen', 'select'),
  keys: fc.uniqueArray(fc.constantFrom(...KEYS), { maxLength: 4 }),
  when,
}).map(({ id, owner, keys, when: w }) => {
  const children: Record<string, PrefChild> = {};
  for (const k of keys) Object.defineProperty(children, k, { value: node(`n${serial++}`), enumerable: true, writable: true, configurable: true });
  const def: MenuDef = { id, menu: { kind: 'group', name: id, description: '', children } as unknown as PrefGroup, ...(w ? { when: w } : {}) };
  return { def, owner };
});

describe('mergeMenuDefs', () => {
  it('keeps every child of every live contribution once, in order, under its own key while it is free, and separates contributions', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(ownedDef, { maxLength: 5 }), fc.constantFrom<string | null>(null, 'pen', 'select'), (defs, tool) => {
      const frozen = JSON.stringify(defs, (_k, v) => v);
      const merged = mergeMenuDefs(defs, tool);
      const live = [...defs.filter((d) => d.owner === null), ...defs.filter((d) => d.owner !== null && d.owner === tool)];
      expect(merged.map((m) => m.id)).toEqual([...new Set(live.map((d) => d.def.id))]);
      for (const m of merged) {
        const parts = live.filter((d) => d.def.id === m.id);
        const own = Object.entries(m.menu.children);
        expect(Object.getPrototypeOf(m.menu.children)).toBe(Object.prototype);
        const rows = own.filter(([, n]) => (n as { kind: string }).kind !== 'separator').map(([, n]) => n);
        expect(rows).toEqual(parts.flatMap((p) => Object.values(p.def.menu.children)));
        expect(own.length - rows.length).toBe(parts.length - 1);
        if (parts.length > 1) t.hit('merged');
        // The first part's children keep their keys.
        for (const [k, n] of Object.entries(parts[0]!.def.menu.children)) expect(m.menu.children[k]).toBe(n);
        expect(m.when).toEqual(parts.find((p) => p.def.when)?.def.when);
        if (parts.length > 1 && Object.keys(parts[0]!.def.menu.children).some((k) => k.startsWith('~sep'))) t.hit('sep key taken');
      }
      expect(JSON.stringify(defs, (_k, v) => v)).toBe(frozen);
    }), runs(400));
    t.expectHit('merged', 'sep key taken');
  }, timeoutFor(400, 1));
});

describe('pickMenu', () => {
  const hit: fc.Arbitrary<MenuHit> = fc.record({ bodyTarget: fc.constantFrom(...BODY), bodyKind: fc.constantFrom('rect', 'path') }, { requiredKeys: [] });
  const oneOf = (want: unknown, got: unknown) => want === undefined || (Array.isArray(want) ? want.includes(got) : want === got);

  it('picks the first def whose when matches every field it names', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(ownedDef, { maxLength: 5 }), hit, (defs, h) => {
      const ds = defs.map((d) => d.def);
      const want = ds.find((d) => d.when !== undefined && oneOf(d.when.bodyTarget, h.bodyTarget) && oneOf(d.when.bodyKind, h.bodyKind));
      expect(pickMenu(ds, h)).toBe(want);
      t.hit(want ? 'picked' : 'none');
    }), runs(300));
    t.expectHit('picked', 'none');
  }, timeoutFor(300, 1));
});
