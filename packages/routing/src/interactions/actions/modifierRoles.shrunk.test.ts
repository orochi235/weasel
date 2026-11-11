/** Roles named like `Object.prototype` members, as modifier roles' property test shrank them. */
import { describe, expect, it } from 'vitest';
import { rebindRoles, resolveRoles, roleKeysOf, roleReader } from './modifierRoles';

const none = { alt: false, ctrl: false, meta: false, shift: false };

describe('modifier roles, shrunk', () => {
  it('keeps a role named __proto__ as a role', () => {
    const roles = JSON.parse('{"__proto__":{"label":"p","keys":["alt"]}}');
    expect(Object.keys(roleKeysOf(roles, {})!)).toEqual(['__proto__']);
    expect(Object.keys(resolveRoles({ ...roleKeysOf(roles)! }, { ...none, alt: true }, false))).toEqual(['__proto__']);
    expect(Object.keys(rebindRoles(roles, {}))).toEqual(['__proto__']);
  });

  it('reads a role named toString by its own keys, not the prototype\'s method', () => {
    const roles = { toString: { label: 't', keys: ['shift' as const] } };
    expect(roleKeysOf(roles, {})!.toString).toEqual(['shift']);
    expect(rebindRoles(roles, {}).toString.keys).toEqual(['shift']);
    expect(roleReader(roles)({ roles: {}, modifiers: { ...none, shift: true } }, 'toString')).toBe(true);
  });
});
