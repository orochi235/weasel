import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from './definition';
import { bake } from './engine/bake';
import { axisDependencies } from './engine/deps';
import { emitCss } from './engine/emit/css';

const MODE = { mode: { default: 'dark', values: { dark: {}, light: {} } } } as const;
const plain: ThemeDefinition = { name: 'plain', axes: MODE, pins: { ink: { value: '#111111', type: 'color' } } };
const quiet: ThemeDefinition = {
  name: 'quiet',
  axes: { ...MODE, bars: { default: 'thin', values: { thin: {}, wide: {} } } },
  pins: {
    'scrollbar-width': { by: 'bars', thin: { value: 'thin', type: 'string' }, wide: { value: 'auto', type: 'string' } },
  },
};
const emit = (def: ThemeDefinition) =>
  emitCss([{ baked: bake(def, () => undefined), deps: axisDependencies(def, () => undefined), isDefault: true }]);

describe('scrollbar rules in tokens.css', () => {
  it('declares scrollbar-color on every element that can change its token, and scrollbar-width on every element', () => {
    const css = emit(quiet);
    expect(css).toContain(
      ':where(:root, [data-wzl-theme], [data-wzl-mode], [data-wzl-bars]) {\n  scrollbar-color: var(--wzl-scrollbar-color, auto);\n}',
    );
    expect(css).toContain(':where(*) {\n  scrollbar-width: var(--wzl-scrollbar-width, auto);\n}');
  });

  it('leaves scrollbars alone for a theme with no scrollbar tokens', () => {
    expect(emit(plain)).not.toContain('scrollbar');
  });
});
