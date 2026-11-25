import { describe, expect, it } from 'vitest';
import { roleMods, withRoleMods } from './modifierRoles';

describe('withRoleMods', () => {
  it('leaves a spec alone when the moved role declared no keys, which says nothing of how the spec was written', () => {
    const roles = { r: { label: 'R', keys: [] } };
    const spec = { kind: 'drag' as const };
    expect(withRoleMods(spec, roles, { r: ['alt'] })).toBe(spec);
  });

  it("widens a spec written with roleMods to a moved role's new keys", () => {
    const roles = { r: { label: 'R', keys: ['shift' as const] } };
    const spec = { kind: 'drag' as const, mods: roleMods(roles) };
    expect(withRoleMods(spec, roles, { r: ['alt'] }).mods).toEqual({ shift: 'optional', alt: 'optional' });
  });
});
