import { describe, it, expect } from 'vitest';
import { always, never } from 'domains/chrome-caps/conditions';
import { presetChromeRules, resolveFeatures } from './features';

describe('presetChromeRules', () => {
  it("keeps the refining preset's rule for a chrome id both give", () => {
    const enabled = resolveFeatures([
      { id: 'base', chromeRules: { 'x.chrome': never } },
      { id: 'refiner', refines: ['base'], chromeRules: { 'x.chrome': always } },
    ]);
    expect(presetChromeRules(enabled, [])['x.chrome']).toBe(always);
  });

  it('throws when two unrelated presets give one chrome id different rules', () => {
    const enabled = resolveFeatures([
      { id: 'a', chromeRules: { 'x.chrome': never } },
      { id: 'b', chromeRules: { 'x.chrome': always } },
    ]);
    expect(() => presetChromeRules(enabled, [])).toThrow(/"a" and "b"/);
  });

  it('lets two presets give one chrome id the same rule', () => {
    const enabled = resolveFeatures([
      { id: 'a', chromeRules: { 'x.chrome': never } },
      { id: 'b', chromeRules: { 'x.chrome': never } },
    ]);
    expect(presetChromeRules(enabled, [])['x.chrome']).toBe(never);
  });
});
