import { expect, test } from '@playwright/test';
import type { ThemeDefinition } from '../../packages/theme/src/definition';
import { axisDependencies, bake, emitCss } from '../../packages/theme/src/engine';

// `frame` varies by mode itself and reaches density only through `edge` → `gap`.
// Declared in :root alone, `var(--wzl-edge)` would resolve once, at :root's
// density, and every compact subtree would inherit the comfortable value.
const PROBE: ThemeDefinition = {
  name: 'probe',
  axes: {
    mode: { default: 'dark', values: { dark: {}, light: {} } },
    density: { default: 'comfortable', values: { comfortable: {}, compact: {} } },
  },
  pins: {
    gap: { by: 'density', comfortable: { value: '40px', type: 'dimension' }, compact: { value: '30px', type: 'dimension' } },
    edge: { value: '{gap}', type: 'dimension' },
    frame: { by: 'mode', dark: { value: '{edge}', type: 'dimension' }, light: { value: '100px', type: 'dimension' } },
  },
};

const css = emitCss([{ baked: bake(PROBE), deps: axisDependencies(PROBE), isDefault: true }]);

test('a token that depends on two axes through a reference resolves per subtree', async ({ page }) => {
  const cell = (mode: string, density: string) =>
    `<div data-wzl-mode="${mode}" data-wzl-density="${density}"><div class="probe" id="${mode}-${density}"></div></div>`;
  await page.setContent(
    `<style>${css}\n.probe { width: var(--wzl-frame); height: 1px; }</style>` +
      cell('dark', 'comfortable') + cell('dark', 'compact') + cell('light', 'comfortable') + cell('light', 'compact'),
  );
  const width = (id: string) => page.$eval(`#${id}`, (el) => getComputedStyle(el).width);
  expect(await width('dark-comfortable')).toBe('40px');
  expect(await width('dark-compact')).toBe('30px');
  expect(await width('light-comfortable')).toBe('100px');
  expect(await width('light-compact')).toBe('100px');
});
