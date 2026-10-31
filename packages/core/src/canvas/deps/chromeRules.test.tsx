import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { always, never, type VisibilityRules } from 'domains/chrome-caps';
import { useChromeRulesDep } from './chromeRules';

describe('useChromeRulesDep', () => {
  it('lays a rule set through the dep over the rules it is given, and keeps its identity', () => {
    const given: VisibilityRules = { 'path-edit.comb': never };
    const { result } = renderHook(({ rules }) => useChromeRulesDep(rules), { initialProps: { rules: given } });
    const dep = result.current.dep;
    expect(dep.get('path-edit.comb')).toBe(never);
    expect(dep.get('path-edit.corners')).toBeUndefined();
    act(() => dep.set('path-edit.comb', always));
    expect(result.current.rules['path-edit.comb']).toBe(always);
    expect(result.current.dep.get('path-edit.comb')).toBe(always);
    expect(result.current.dep).toBe(dep);
  });
});
