import { type ConfigBranch, type ConfigNode, f } from '@weasel-js/labkit/config';
import { describe, expect, it } from 'vitest';
import { effectiveGlobals, type GlobalDeclarations, isGlobalsPath, labGlobals, storyConfig, withGlobals } from './globals';

const declarations: GlobalDeclarations = {
  mode: {
    label: 'Mode',
    default: 'auto',
    options: [
      { value: 'auto', label: 'Auto' },
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
    ],
  },
  font: { label: 'Font', default: 'oswald', options: [{ value: 'oswald', label: 'Oswald' }, { value: 'inter', label: 'Inter' }] },
};

describe('labGlobals', () => {
  it('takes each declared default when nothing is stored', () => {
    expect(labGlobals(declarations, undefined)).toEqual({ mode: 'auto', font: 'oswald' });
  });

  it('keeps stored values an option offers, and drops undeclared keys and values no option offers', () => {
    expect(labGlobals(declarations, { mode: 'dark', font: 'comic', gone: 'x' })).toEqual({ mode: 'dark', font: 'oswald' });
  });
});

describe('effectiveGlobals', () => {
  const lab = { mode: 'auto', font: 'oswald' };

  it('is the lab’s values when the trial pins nothing', () => {
    expect(effectiveGlobals(lab, undefined)).toBe(lab);
    expect(effectiveGlobals(lab, { mode: 'lab', font: 'lab' })).toBe(lab);
  });

  it('lets a pinned value win over the lab’s, leaving the rest following the lab', () => {
    expect(effectiveGlobals(lab, { mode: 'dark', font: 'lab' })).toEqual({ mode: 'dark', font: 'oswald' });
  });
});

describe('storyConfig', () => {
  it('strips the pins', () => {
    expect(storyConfig({ label: 'hi', $globals: { mode: 'dark' } })).toEqual({ label: 'hi' });
  });

  it('passes a config with no pins through as it is', () => {
    const config = { label: 'hi' };
    expect(storyConfig(config)).toBe(config);
  });

  it('returns the previous story config when only a pin changed', () => {
    const inner = { size: 4 };
    const previous = storyConfig({ label: 'hi', grid: inner, $globals: { mode: 'lab' } });
    expect(storyConfig({ label: 'hi', grid: inner, $globals: { mode: 'dark' } }, previous)).toBe(previous);
    expect(storyConfig({ label: 'bye', grid: inner, $globals: { mode: 'dark' } }, previous)).toEqual({ label: 'bye', grid: inner });
  });
});

describe('withGlobals', () => {
  const schema = f.schema({ label: f.string('hi') });

  it('leaves a schema alone when nothing is declared', () => {
    expect(withGlobals(schema, {})).toBe(schema);
  });

  it('appends a $globals group of lab-following enums, under a Globals section', () => {
    const out = withGlobals(schema, declarations);
    expect(Object.keys(out.nodes)).toEqual(['label', '$globals']);
    expect(out.defaults()).toEqual({ label: 'hi', $globals: { mode: 'lab', font: 'lab' } });
    const group = out.nodes.$globals as ConfigBranch;
    expect(group.options.section).toEqual({ label: 'Globals', layout: 'inline', pack: 'pairs' });
    const mode = group.children.mode as ConfigNode<string>;
    expect(mode.kind).toBe('enum');
    expect(mode.annotations.name).toBe('Mode');
    expect(mode.annotations.options).toEqual([
      { value: 'lab', label: 'Lab' },
      ...declarations.mode!.options,
    ]);
  });
});

describe('isGlobalsPath', () => {
  it('matches the group and paths beneath it only', () => {
    expect([isGlobalsPath('$globals'), isGlobalsPath('$globals.mode'), isGlobalsPath('$globalsx'), isGlobalsPath('mode')]).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
});
