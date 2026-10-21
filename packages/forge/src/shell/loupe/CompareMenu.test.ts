import { f } from '@weasel-js/labkit/config';
import { createLensScene, settingsOf } from '@weasel-js/labkit/loupe';
import { describe, expect, it } from 'vitest';
import { FOLLOW_APP, type GlobalDeclarations, GLOBALS_KEY } from '../globals';
import { COMPARE_WITH_ID, compareChoices, compareMenuDef, compareWithAction } from './CompareMenu';
import type { ForgeComparison } from './conditions';
import { createApi } from './ForgeLoupe';

/** The workshop's lens API over a fresh scene, with one lens up. */
function createSettledLensApi() {
  const scene = createLensScene<ForgeComparison>();
  const api = createApi(scene, {
    body: { current: document.createElement('div') },
    pointer: { current: null },
    focus: { current: null },
    sources: { current: {} },
  });
  return { api, lensId: api.add() as string };
}

const DECLARATIONS: GlobalDeclarations = {
  theme: {
    label: 'Theme',
    default: 'paper',
    options: [
      { value: 'paper', label: 'Paper' },
      { value: 'ocean', label: 'Ocean' },
    ],
  },
};

const schema = f.schema({
  label: f.string('Go'),
  size: f.enum('m', ['s', 'm', 'l']),
  grid: f.group({ on: f.boolean(false), step: f.number(4) }),
  [GLOBALS_KEY]: f.group({ theme: f.enum(FOLLOW_APP, [FOLLOW_APP, 'paper']) }),
});

describe('compareChoices', () => {
  it('offers each declared global’s options, DPR 1×, 2× and 3×, and every boolean or optioned arg', () => {
    const choices = compareChoices(DECLARATIONS, schema);
    expect(choices.map((c) => `${c.group} / ${c.label}`)).toEqual([
      'Theme / Paper',
      'Theme / Ocean',
      'DPR / 1×',
      'DPR / 2×',
      'DPR / 3×',
      'Arg size / s',
      'Arg size / m',
      'Arg size / l',
      'Arg grid.on / On',
      'Arg grid.on / Off',
    ]);
    expect(choices.find((c) => c.key === 'global.theme.ocean')?.compare).toEqual({ kind: 'custom', globals: { theme: 'ocean' } });
    expect(choices.find((c) => c.key === 'dpr.2')?.compare).toEqual({ kind: 'custom', dpr: 2 });
    expect(choices.find((c) => c.key === 'arg.grid.on.true')?.compare).toEqual({ kind: 'custom', args: { 'grid.on': true } });
  });

  it('offers no args without a story under the lens', () => {
    expect(compareChoices(DECLARATIONS, null).some((c) => c.group.startsWith('Arg'))).toBe(false);
  });
});

describe('the compare menu', () => {
  it('puts each group in a submenu whose rows name a variant of the compare action', () => {
    const def = compareMenuDef(compareChoices(DECLARATIONS, null));
    const groups = Object.values(def.menu.children) as { name: string; children: Record<string, { action?: string }> }[];
    expect(groups.map((g) => g.name)).toEqual(['Theme', 'DPR']);
    expect(Object.values(groups[0]!.children).map((r) => r.action)).toEqual([
      `${COMPARE_WITH_ID}:global.theme.paper`,
      `${COMPARE_WITH_ID}:global.theme.ocean`,
    ]);
  });

  it('sets the current lens’s comparison from the row picked', () => {
    const { api, lensId } = createSettledLensApi();
    const choices = compareChoices(DECLARATIONS, null);
    const action = compareWithAction(api, choices);
    const variant = action.variants?.find((v) => v.key === 'dpr.3');
    if (action.invoker?.timing !== 'immediate' || !variant) throw new Error('an immediate action with a dpr.3 row');
    action.invoker.run({}, variant.params);
    expect(settingsOf(api.scene, lensId)?.compare).toEqual({ kind: 'custom', dpr: 3 });
  });
});
