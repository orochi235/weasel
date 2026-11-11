/** Counterexamples `valueRows.pbt.test.ts` found in the color picker, kept as plain cases. */
import { describe, expect, it } from 'vitest';
import type { MenuColorEntry, MenuEntry } from '@weasel-js/menu';
import { withColorPickers } from './colorPicker';

describe('withColorPickers, shrunk', () => {
  it('reads a named swatch unchecked while the row holds no color, and checked once chosen', () => {
    let held: string | undefined;
    const c = { colorValue: () => held, setColor: (_e: MenuColorEntry, v: string) => { held = v; } };
    const { entries } = withColorPickers([{ kind: 'color', key: 'c', label: 'C', value: undefined, set: () => {} }], ['red'], () => c);
    const swatch = (entries[0] as Extract<MenuEntry, { kind: 'submenu' }>).entries[0] as Extract<MenuEntry, { kind: 'item' }>;
    expect(swatch.checked).toBe(false);
    swatch.run();
    expect(held).toBe('red');
    expect(swatch.checked).toBe(true);
  });
});
