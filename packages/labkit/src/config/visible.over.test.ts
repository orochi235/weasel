import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { f } from './builder';
import { resolveConfigSchema } from './resolve';
import { isRowEnabled, isRowVisible } from './visible';

const flag = (name: string, def: boolean): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: def }) as PrefLeaf;

const over: PrefGroup = {
  name: 'Preferences',
  children: { view: { name: 'View', children: { grid: flag('Show grid', true) } } },
};

describe('visibility over another schema', () => {
  it("leaves an alias into `over` alone where the panel's own group of that name is hidden", () => {
    const resolved = resolveConfigSchema(
      f.schema({
        view: f
          .group({ size: f.number(1) })
          .showIf(() => false)
          .enableIf(() => false),
        grid: f.alias('view.grid'),
      }),
    );
    const config = { view: { size: 1 } };
    expect(isRowVisible(resolved, 'grid', config, false, over)).toBe(true);
    expect(isRowEnabled(resolved, 'grid', config, over)).toBe(true);
  });
});
