import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../definition';
import { contrast } from './color/oklch';
import { derive } from './derive';

const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
const SHIPPING = ['#f5f5f6', '#e6e7e9', '#c9cbcf', '#9ea1a8', '#6f737b', '#4d5058', '#383b42', '#25272c', '#181a1e', '#0e0f12'];
const by = (dark: string, light: string) => ({ by: 'mode', dark, light });

const W: ThemeDefinition = {
  name: 'w',
  axes: { mode: { default: 'dark', values: { dark: {}, light: {} } } },
  ramps: { gray: { kind: 'lightness', steps: STEPS, lightness: [0.973, 0.163], curve: 0.41, hue: 266, chroma: { peak: 0.0116, darkBias: 0.84 } } },
  semantics: {
    // Declared before the surfaces it reads, on purpose.
    'border-strong': { ramp: 'gray', contrast: { min: 3, against: ['surface', 'surface-raised', 'surface-sunken'] } },
    surface: { ramp: 'gray', step: by('800', '50') },
    'surface-raised': { ramp: 'gray', step: by('700', '100') },
    'surface-sunken': { ramp: 'gray', step: by('900', '200') },
    'fg-muted': { from: 'surface', offset: 5, dir: 'away' },
    deeper: { from: 'surface', offset: 1, dir: 'darker' },
    paler: { from: 'surface', offset: 1, dir: 'lighter' },
    fg: { ramp: 'gray', step: by('100', '900'), check: { contrast: 4.5, against: ['surface'] } },
    border: { ramp: 'gray', step: by('700', '200'), check: { contrast: 3, against: ['surface'] } },
  },
  pins: Object.fromEntries(STEPS.map((s, i) => [`gray-${s}`, SHIPPING[i]])),
};

const at = (mode: string) => derive(W, { mode });

describe('contrast rule', () => {
  it('walks away from the surfaces to the first step that clears every one', () => {
    expect(at('dark').tokens['border-strong'].value).toBe('{gray-400}');
    expect(at('light').tokens['border-strong'].value).toBe('{gray-500}');
  });

  it('reports when no step clears, and still yields a value', () => {
    const { tokens, issues } = derive(
      { ...W, semantics: { ...W.semantics, 'border-strong': { ramp: 'gray', contrast: { min: 30, against: ['surface'] } } } },
      { mode: 'dark' },
    );
    expect(issues).toContainEqual({
      kind: 'contrast-unmet', token: 'border-strong', min: 30, against: ['surface'], picked: '50', ratio: contrast(SHIPPING[0], SHIPPING[8]),
    });
    expect(tokens['border-strong'].value).toBe('{gray-50}');
  });

  const withSemantics = (semantics: ThemeDefinition['semantics'], pins: ThemeDefinition['pins'] = {}) =>
    derive({ ...W, semantics: { ...W.semantics, ...semantics }, pins: { ...W.pins, ...pins } }, { mode: 'dark' });

  it('starts past a surface off the ramp by lightness, not at a ramp end', () => {
    const { tokens } = withSemantics({
      accent: { value: '#3778b7', type: 'color' },
      x: { ramp: 'gray', contrast: { min: 3, against: ['accent'] } },
    });
    expect(tokens.x.value).toBe('{gray-100}');
  });

  it('starts past a pinned surface, wherever the pin puts it', () => {
    const rule = { 'border-strong': { ramp: 'gray', contrast: { min: 3, against: ['surface'] } } } as const;
    expect(withSemantics(rule, { surface: '{gray-200}' }).tokens['border-strong'].value).toBe('{gray-500}');
    expect(withSemantics(rule, { surface: '#ffffff' }).tokens['border-strong'].value).toBe('{gray-400}');
  });

  it('reports surfaces on both sides of the ramp and yields the best step of all', () => {
    const { tokens, issues } = withSemantics({
      top: { ramp: 'gray', step: '50' },
      mid: { ramp: 'gray', contrast: { min: 5, against: ['top', 'surface-sunken'] } },
    });
    const ratio = Math.min(contrast(SHIPPING[4], SHIPPING[0]), contrast(SHIPPING[4], SHIPPING[9]));
    expect(issues).toContainEqual({ kind: 'contrast-unmet', token: 'mid', min: 5, against: ['top', 'surface-sunken'], picked: '400', ratio });
    expect(tokens.mid.value).toBe('{gray-400}');
  });

  it('yields the best step without an issue when surfaces on both sides of the ramp still let it clear', () => {
    const { tokens, issues } = withSemantics({
      top: { ramp: 'gray', step: '50' },
      mid: { ramp: 'gray', contrast: { min: 3, against: ['top', 'surface-sunken'] } },
    });
    expect(issues.filter((i) => i.kind === 'contrast-unmet')).toEqual([]);
    expect(tokens.mid.value).toBe('{gray-400}');
  });

  const lone = (min: number, pins: ThemeDefinition['pins'] = {}) =>
    derive({
      name: 'lone',
      ramps: { gray: { kind: 'lightness', steps: STEPS, lightness: [0.98, 0.1] } },
      semantics: { s: { value: '#6e6e6e', type: 'color' }, x: { ramp: 'gray', contrast: { min, against: ['s'] } } },
      pins,
    });

  it('walks away from the surfaces the other way when nothing clears the first way', () => {
    const { tokens, issues } = lone(4.3);
    expect(contrast(tokens['gray-900'].value as string, '#6e6e6e')).toBeLessThan(4.3);
    expect(issues).toEqual([]);
    expect(tokens.x.value).toBe('{gray-50}');
  });

  it('takes the first step that clears walking the other way, not the best one', () => {
    const STARK = ['#ffffff', '#f0f0f0', '#c8c8c8', '#a0a0a0', '#888888', '#555555', '#404040', '#282828', '#141414', '#000000'];
    const { tokens, issues } = lone(4.3, Object.fromEntries(STEPS.map((s, i) => [`gray-${s}`, STARK[i]])));
    expect(contrast('#000000', '#6e6e6e')).toBeLessThan(4.3);
    expect(issues).toEqual([]);
    expect(tokens.x.value).toBe('{gray-100}');
  });

  it('reports the best step beyond the surfaces when none clears either way', () => {
    const { tokens, issues } = lone(20);
    const ratio = contrast(tokens['gray-50'].value as string, '#6e6e6e');
    expect(issues).toEqual([{ kind: 'contrast-unmet', token: 'x', min: 20, against: ['s'], picked: '50', ratio }]);
    expect(tokens.x.value).toBe('{gray-50}');
  });

  it('measures against a component', () => {
    const { tokens, issues } = derive(
      { ...W, semantics: { x: { ramp: 'gray', contrast: { min: 3, against: ['tb-bg'] } } }, components: { 'tb-bg': { value: '#ffffff', type: 'color' } } },
      { mode: 'dark' },
    );
    expect(issues).toEqual([]);
    expect(tokens.x.value).toBe('{gray-400}');
  });

  it('throws on a surface nothing declares', () => {
    expect(() => withSemantics({ x: { ramp: 'gray', contrast: { min: 3, against: ['nope'] } } })).toThrow(/nope/);
  });

  it('reports a rule with no surfaces', () => {
    const { issues } = withSemantics({ x: { ramp: 'gray', contrast: { min: 3, against: [] } } });
    expect(issues).toContainEqual({ kind: 'invalid', path: 'semantics.x', message: 'contrast needs at least one surface' });
  });
});

describe('ramp direction', () => {
  const unreadable = (message: string, names: string[]) => names.map((n) => ({ kind: 'invalid', path: `semantics.${n}`, message }));
  const rules = {
    dk: { from: 'surface', offset: 1, dir: 'darker' },
    lt: { from: 'surface', offset: 1, dir: 'lighter' },
    bs: { ramp: 'gray', contrast: { min: 3, against: ['surface'] } },
  } as const;

  const run = (pins: ThemeDefinition['pins']) =>
    derive({ ...W, semantics: { surface: W.semantics!.surface, ...rules }, pins: { ...W.pins, ...pins } }, { mode: 'dark' });
  const message = 'cannot tell which end of ramp "gray" is darker';

  it('is reported, not guessed, when the ramp ends are equally light', () => {
    const { tokens, issues } = run({ 'gray-50': '#777777', 'gray-900': '#777777' });
    expect(issues).toEqual(unreadable(message, ['dk', 'lt', 'bs']));
    expect(Object.keys(tokens).filter((n) => n in rules)).toEqual([]);
  });

  it('is reported, not guessed, when a ramp end is not a solid color', () => {
    const { tokens, issues } = run({ 'gray-900': { value: '#0e0f12', alpha: 0.5 } });
    expect(issues).toEqual([
      ...unreadable(message, ['dk', 'lt']),
      ...unreadable('contrast needs solid colors on both sides', ['bs']),
    ]);
    expect(Object.keys(tokens).filter((n) => n in rules)).toEqual([]);
  });
});

describe('offset rule', () => {
  it('counts from where a pin puts its reference', () => {
    const rule = { 'fg-muted': { from: 'surface', offset: 5, dir: 'away' } } as const;
    const pinned = (pin: string) => derive({ ...W, semantics: { surface: W.semantics!.surface, ...rule }, pins: { ...W.pins, surface: pin } }, { mode: 'dark' });
    expect(pinned('{gray-200}').tokens['fg-muted'].value).toBe('{gray-700}');
    expect(pinned('#ffffff').issues).toEqual([{ kind: 'invalid', path: 'semantics.fg-muted', message: '"surface" does not end on a ramp step' }]);
  });

  it('goes away from the reference toward the far end, so it flips with the mode', () => {
    expect(at('dark').tokens['fg-muted'].value).toBe('{gray-300}');
    expect(at('light').tokens['fg-muted'].value).toBe('{gray-500}');
  });

  it('reads darker and lighter from the ramp colors, not the step order', () => {
    expect(at('dark').tokens.deeper.value).toBe('{gray-900}');
    expect(at('dark').tokens.paler.value).toBe('{gray-700}');
  });

  it('counts from a ref semantic that points at a ramp step', () => {
    const { tokens, issues } = derive(
      { ...W, semantics: { s2: { ref: 'gray-200' }, m: { from: 's2', offset: 2, dir: 'darker' } } },
      { mode: 'dark' },
    );
    expect(issues).toEqual([]);
    expect(tokens.m.value).toBe('{gray-400}');
  });
});

describe('check', () => {
  it('audits without changing the value', () => {
    const { tokens, issues } = at('dark');
    expect(tokens.border.value).toBe('{gray-700}');
    expect(issues.flatMap((i) => (i.kind === 'check-failed' ? [i.token] : []))).toEqual(['border']);
  });

  const failedChecks = (pins: Record<string, string>) =>
    derive({ ...W, pins: { ...W.pins, ...pins } }, { mode: 'dark' }).issues.flatMap((i) => (i.kind === 'check-failed' ? [i.token] : []));

  it('audits the pinned value when the rule passes and the pin fails', () => {
    expect(failedChecks({ fg: '#25272c' })).toEqual(['fg', 'border']);
  });

  it('reports nothing when the rule fails and the pin passes', () => {
    expect(failedChecks({ border: '#9ea1a8' })).toEqual([]);
  });

  const only = (semantics: ThemeDefinition['semantics'], pins: ThemeDefinition['pins'] = {}) =>
    derive({ ...W, semantics: { surface: W.semantics!.surface, ...semantics }, pins: { ...W.pins, ...pins } }, { mode: 'dark' });

  it('is never a dependency, so checking against what reads you is no cycle', () => {
    const fg = only({
      'accent-fg': { ramp: 'gray', contrast: { min: 4.5, against: ['accent-bg'] } },
      'accent-bg': { ramp: 'gray', step: '700', check: { contrast: 4.5, against: ['accent-fg'] } },
    });
    expect(fg.issues).toEqual([]);
    const offset = only({
      'accent-bg': { ramp: 'gray', step: '700', check: { contrast: 4.5, against: ['on-accent'] } },
      'on-accent': { from: 'accent-bg', offset: 5, dir: 'away' },
    });
    expect(offset.tokens['on-accent'].value).toBe('{gray-200}');
    expect(only({ z: { ramp: 'gray', step: '400', check: { contrast: 3, against: ['z'] } } }).issues).toEqual([
      { kind: 'check-failed', token: 'z', against: 'z', min: 3, ratio: 1 },
    ]);
  });

  it('names the semantic when its own pin is not solid', () => {
    const { issues } = only(
      { fg: { ramp: 'gray', step: '100', check: { contrast: 4.5, against: ['surface'] } } },
      { fg: { value: '#ffffff', alpha: 0.5 } },
    );
    expect(issues).toEqual([{ kind: 'invalid', path: 'semantics.fg.check', message: '"fg" is not a solid color' }]);
  });

  it('audits the pin of a semantic whose rule failed', () => {
    const { issues } = only({ fg: { ramp: 'gray', step: '850', check: { contrast: 4.5, against: ['surface'] } } }, { fg: '#25272c' });
    expect(issues).toContainEqual({ kind: 'check-failed', token: 'fg', against: 'surface', min: 4.5, ratio: contrast('#25272c', SHIPPING[8]) });
  });

  it('audits against a component', () => {
    const { issues } = derive(
      { ...W, semantics: { fg: { ramp: 'gray', step: '100', check: { contrast: 3, against: ['tb-bg'] } } }, components: { 'tb-bg': { value: '#ffffff', type: 'color' } } },
      { mode: 'dark' },
    );
    expect(issues).toEqual([{ kind: 'check-failed', token: 'fg', against: 'tb-bg', min: 3, ratio: contrast(SHIPPING[1], '#ffffff') }]);
  });

  it('throws on a name nothing declares, but not on one that failed at this selection', () => {
    expect(() => only({ fg: { ramp: 'gray', step: '100', check: { contrast: 3, against: ['nope'] } } })).toThrow(/nope/);
    expect(() => only({ fg: { ramp: 'gray', step: '100', check: { contrast: 3, against: ['bad'] } }, bad: { ramp: 'gray', step: '850' } })).not.toThrow();
  });

  it('leaves a surface whose production failed to that failure', () => {
    const { issues } = only({ fg: { ramp: 'gray', step: '100', check: { contrast: 3, against: ['bad'] } }, bad: { ramp: 'gray', step: '850' } });
    expect(issues).toEqual([{ kind: 'invalid', path: 'semantics.bad', message: 'no such step on ramp "gray"' }]);
  });

  it('reports a check with no surfaces', () => {
    const { issues } = only({ fg: { ramp: 'gray', step: '100', check: { contrast: 3, against: [] } } });
    expect(issues).toEqual([{ kind: 'invalid', path: 'semantics.fg.check', message: 'check needs at least one surface' }]);
  });
});

describe('alpha pins', () => {
  it('are not solid colors to measure contrast against', () => {
    const { issues } = derive({ ...W, pins: { ...W.pins, surface: { value: '#181a1e', alpha: 0.5 } } }, { mode: 'dark' });
    expect(issues).toContainEqual({ kind: 'invalid', path: 'semantics.border-strong', message: 'contrast needs solid colors on both sides' });
  });
});
