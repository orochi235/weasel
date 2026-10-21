import { describe, expect, it } from 'vitest';
import { FOLLOW_APP, type GlobalDeclarations } from '../globals';
import {
  describeComparison,
  describeLens,
  type ForgeComparison,
  type LabConditions,
  type ResolveContext,
  resolveComparison,
} from './conditions';

const MODE = {
  label: 'Mode',
  default: 'auto',
  options: [
    { value: 'auto', label: 'Auto' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'sepia', label: 'Sepia' },
  ],
};
const DECLARATIONS: GlobalDeclarations = {
  mode: MODE,
  theme: {
    label: 'Theme',
    default: 'paper',
    options: [
      { value: 'paper', label: 'Paper' },
      { value: 'ocean', label: 'Ocean' },
    ],
  },
};
const OPPOSITE: ForgeComparison = { kind: 'opposite-mode' };
const ctx = (over: Partial<ResolveContext> = {}): ResolveContext => ({
  declarations: DECLARATIONS,
  modeGlobal: 'mode',
  prefersDark: false,
  labMode: 'light',
  ...over,
});

describe('resolveComparison: opposite mode', () => {
  it('flips light to dark and resolves auto by the OS scheme', () => {
    expect(resolveComparison(OPPOSITE, { mode: 'light', theme: 'paper' }, ctx()).globals).toEqual({ mode: 'dark', theme: 'paper' });
    expect(resolveComparison(OPPOSITE, { mode: 'dark' }, ctx()).globals.mode).toBe('light');
    expect(resolveComparison(OPPOSITE, { mode: 'auto' }, ctx({ prefersDark: true })).globals.mode).toBe('light');
    expect(resolveComparison(OPPOSITE, { mode: 'auto' }, ctx({ prefersDark: false })).globals.mode).toBe('dark');
  });

  it('resolves App through the lab’s own mode, and an auto lab through the OS', () => {
    expect(resolveComparison(OPPOSITE, { mode: FOLLOW_APP }, ctx({ labMode: 'dark' })).globals.mode).toBe('light');
    expect(resolveComparison(OPPOSITE, { mode: FOLLOW_APP }, ctx({ labMode: 'auto', prefersDark: true })).globals.mode).toBe('light');
  });

  it('keeps showing the opposite after the lab mode changes', () => {
    // The comparison is chosen once and resolved on every render, against the lab as it is then.
    const chosen = OPPOSITE;
    expect(resolveComparison(chosen, { mode: FOLLOW_APP }, ctx({ labMode: 'light' })).globals.mode).toBe('dark');
    expect(resolveComparison(chosen, { mode: FOLLOW_APP }, ctx({ labMode: 'dark' })).globals.mode).toBe('light');
  });

  it('flips the globals it is given, so a trial pinned light under a dark lab flips to dark', () => {
    const trialOwn = { mode: 'light', theme: 'paper' };
    expect(resolveComparison(OPPOSITE, trialOwn, ctx({ labMode: 'dark' })).globals.mode).toBe('dark');
  });

  it('uses a declaration’s own opposite over the default swap', () => {
    const declarations: GlobalDeclarations = {
      ...DECLARATIONS,
      mode: { ...MODE, opposite: (value) => (value === 'light' ? 'sepia' : value === 'sepia' ? 'light' : undefined) },
    };
    expect(resolveComparison(OPPOSITE, { mode: 'light' }, ctx({ declarations })).globals.mode).toBe('sepia');
    expect(resolveComparison(OPPOSITE, { mode: 'sepia' }, ctx({ declarations })).globals.mode).toBe('light');
  });

  it('hands a declaration’s opposite the mode auto resolves to, and the globals it flips', () => {
    const seen: unknown[] = [];
    const declarations: GlobalDeclarations = {
      ...DECLARATIONS,
      mode: { ...MODE, opposite: (value, globals) => (seen.push([value, globals.theme]), 'light') },
    };
    resolveComparison(OPPOSITE, { mode: 'auto', theme: 'ocean' }, ctx({ declarations, prefersDark: true }));
    expect(seen).toEqual([['dark', 'ocean']]);
  });

  it('shows the story unchanged for a mode with no opposite', () => {
    const base = { mode: 'sepia', theme: 'paper' };
    expect(resolveComparison(OPPOSITE, base, ctx()).globals).toBe(base);
  });

  it('leaves args and DPR alone', () => {
    const r = resolveComparison(OPPOSITE, { mode: 'light' }, ctx());
    expect(r.args).toEqual({});
    expect(r.dpr).toBeNull();
  });
});

describe('describeComparison', () => {
  it('names opposite mode, a global by its labels, an arg and a DPR', () => {
    expect(describeComparison(OPPOSITE, DECLARATIONS)).toBe('Opposite mode');
    expect(describeComparison({ kind: 'custom', globals: { theme: 'ocean' } }, DECLARATIONS)).toBe('Theme: Ocean');
    expect(describeComparison({ kind: 'custom', args: { size: 3 } }, DECLARATIONS)).toBe('Arg size = 3');
    expect(describeComparison({ kind: 'custom', dpr: 2 }, DECLARATIONS)).toBe('DPR 2×');
  });

  it('joins several conditions, and names an undeclared global by its key and value', () => {
    expect(describeComparison({ kind: 'custom', globals: { theme: 'ocean', accent: 'red' }, dpr: 3 }, DECLARATIONS)).toBe(
      'Theme: Ocean, accent: red, DPR 3×',
    );
  });

  it('says when the mode it would flip has no opposite', () => {
    expect(describeComparison(OPPOSITE, DECLARATIONS, { base: { mode: 'sepia' }, ctx: ctx() })).toBe(
      "Opposite mode: no opposite for 'sepia'",
    );
    expect(describeComparison(OPPOSITE, DECLARATIONS, { base: { mode: 'light' }, ctx: ctx() })).toBe('Opposite mode');
  });
});

describe('describeLens', () => {
  const lab = (mode: string): LabConditions => ({
    labValues: { mode, theme: 'paper' },
    mode: 'light',
    declarations: DECLARATIONS,
    modeGlobal: 'mode',
  });
  const pinned = (mode: string) => ({ $globals: { mode } });

  it('says there is no opposite for a trial pinned to a mode without one, under a lab mode that has one', () => {
    expect(describeLens(OPPOSITE, lab('light'), pinned('sepia'), false)).toBe("Opposite mode: no opposite for 'sepia'");
  });

  it('names opposite mode for a trial pinned to a mode with one, under a lab mode that has none', () => {
    expect(describeLens(OPPOSITE, lab('sepia'), pinned('dark'), false)).toBe('Opposite mode');
    expect(describeLens(OPPOSITE, lab('sepia'), {}, false)).toBe("Opposite mode: no opposite for 'sepia'");
  });

  it('says a DPR applies to Pixels only on a lens that shows none', () => {
    const dpr: ForgeComparison = { kind: 'custom', dpr: 2 };
    expect(describeLens(dpr, lab('light'), {}, false)).toBe('DPR 2× (Pixels only)');
    expect(describeLens(dpr, lab('light'), {}, true)).toBe('DPR 2×');
  });
});
