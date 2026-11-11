/**
 * Property tests of modifier roles over role ids of any spelling, `Object.prototype`'s member names among them:
 * every role an action declares is resolved, rebound, and made optional by its own keys, and nothing else.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { isApplePlatform, matchModifiers, type ModifierKey } from '@weasel-js/gestures';
import { runs, tally } from '../../pbt.fixture';
import {
  keysHeld, platformRoleKeys, rebindRoles, resolveRoles, roleKeysOf, roleMods, roleReader,
  type ModifierRole, type RoleKeys,
} from './modifierRoles';

const PROTO_IDS = ['__proto__', 'toString', 'constructor', 'hasOwnProperty', 'valueOf'];
const roleId = fc.oneof(fc.constantFrom(...PROTO_IDS, 'snap', 'handle.holdAngle'), fc.string({ maxLength: 4 }));
const KEYS: ModifierKey[] = ['alt', 'ctrl', 'meta', 'shift', 'mod'];
const roleKeys: fc.Arbitrary<RoleKeys> = fc.subarray(KEYS);

/** A record holding each entry as an own property, as one read from JSON does, `__proto__` included. */
function own<V>(entries: readonly (readonly [string, V])[]): Record<string, V> {
  const out: Record<string, V> = {};
  for (const [k, v] of entries) Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
  return out;
}

const roles = fc.uniqueArray(fc.tuple(roleId, roleKeys), { selector: ([id]) => id, maxLength: 5 })
  .map((es) => own(es.map(([id, keys]) => [id, { label: id, keys }] as const)));
const rebinds = (ids: string[]) => fc.subarray(ids).chain((picked) =>
  fc.tuple(...picked.map((id) => fc.tuple(fc.constant(id), roleKeys))).map((es) => own(es)));
const modifiers = fc.record({ alt: fc.boolean(), ctrl: fc.boolean(), meta: fc.boolean(), shift: fc.boolean() });

describe('modifier roles', () => {
  it('resolves, rebinds, and lists exactly the roles declared, each by its own keys', () => {
    const t = tally();
    fc.assert(fc.property(
      roles.chain((r) => fc.tuple(fc.constant(r), rebinds(Object.keys(r)))), modifiers, fc.boolean(),
      ([declared, given], mods, isMac) => {
        const ids = Object.keys(declared);
        if (ids.some((id) => PROTO_IDS.includes(id))) t.hit('prototype id');
        const keys = roleKeysOf(declared, given)!;
        expect(Object.keys(keys).sort()).toEqual([...ids].sort());
        const rebound = rebindRoles(declared, given);
        expect(Object.keys(rebound).sort()).toEqual([...ids].sort());
        const platform = platformRoleKeys(keys, isMac);
        const held = resolveRoles(keys, mods, isMac);
        expect(Object.keys(held).sort()).toEqual([...ids].sort());
        for (const id of ids) {
          const want = Object.hasOwn(given, id) ? given[id] : declared[id].keys;
          expect(Object.getOwnPropertyDescriptor(keys, id)?.value).toEqual(want);
          expect((Object.getOwnPropertyDescriptor(rebound, id)?.value as ModifierRole).keys)
            .toEqual(want);
          expect(Object.getOwnPropertyDescriptor(held, id)?.value).toBe(keysHeld(want, mods, isMac));
          const plain = Object.getOwnPropertyDescriptor(platform, id)?.value as RoleKeys;
          expect(plain).not.toContain('mod');
          expect(keysHeld(plain, mods, isMac)).toBe(keysHeld(want, mods, isMac));
          const read = roleReader(declared);
          expect(read({ roles: held, modifiers: mods }, id)).toBe(keysHeld(want, mods, isMac));
          expect(read({ roles: {}, modifiers: mods }, id)).toBe(keysHeld(declared[id].keys, mods, isApplePlatform()));
        }
      },
    ), runs(300));
    t.expectHit('prototype id');
  });

  it('lets every key a role names be held or not from the press', () => {
    fc.assert(fc.property(roles, modifiers, fc.boolean(), (declared, mods, isMac) => {
      const spec = roleMods(declared);
      const named = new Set(Object.values(declared).flatMap((r) => r.keys)
        .flatMap((k) => (k === 'mod' ? ['meta', 'ctrl'] : [k])));
      const free = { ...mods };
      for (const k of ['alt', 'ctrl', 'meta', 'shift'] as const) if (!named.has(k)) free[k] = false;
      expect(matchModifiers({ altKey: free.alt, ctrlKey: free.ctrl, metaKey: free.meta, shiftKey: free.shift }, spec, isMac))
        .toBe(true);
    }), runs(300));
  });
});
