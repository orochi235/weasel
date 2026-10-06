import { type ConfigBranch, type ConfigNode, f } from '@weasel-js/labkit/config';
import { describe, expect, it } from 'vitest';
import {
  effectiveGlobals,
  FOLLOW_APP,
  followApp,
  type GlobalDeclarations,
  isForgePath,
  isGlobalsPath,
  labGlobals,
  labOptions,
  storyConfig,
  withGlobals,
} from './globals';

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

  it('moves a value its `shows` hides to the nearest option that shows, the earlier on a tie', () => {
    const sizes = ['xs', 's', 'm', 'l', 'xl'].map((value) => ({ value, label: value }));
    const onlyFor: Record<string, string[]> = { oswald: ['s', 'xl'], inter: ['xs', 'm', 'xl'] };
    const shaped: GlobalDeclarations = {
      ...declarations,
      size: { label: 'Size', default: 'm', options: sizes, shows: (value, globals) => onlyFor[String(globals.font)]!.includes(value) },
    };
    expect(labGlobals(shaped, { font: 'oswald', size: 'm' }).size).toBe('s');
    expect(labGlobals(shaped, { font: 'oswald', size: 'l' }).size).toBe('xl');
    expect(labGlobals(shaped, { font: 'inter', size: 'l' }).size).toBe('m');
    expect(labGlobals(shaped, { font: 'inter', size: 'xs' }).size).toBe('xs');
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

  it('strips the kept playhead too, and a change to it alone is no change', () => {
    const previous = storyConfig({ label: 'hi', $playhead: 1000 });
    expect(previous).toEqual({ label: 'hi' });
    expect(storyConfig({ label: 'hi', $playhead: 2000 }, previous)).toBe(previous);
  });
});

describe('isForgePath', () => {
  it('names the keys a story may not write', () => {
    expect(isForgePath('$playhead')).toBe(true);
    expect(isForgePath('$globals.mode')).toBe(true);
    expect(isForgePath('label')).toBe(false);
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

describe('a global that follows the app', () => {
  const following: GlobalDeclarations = {
    ...declarations,
    mode: { ...declarations.mode!, default: FOLLOW_APP, follows: (chrome) => chrome.mode },
  };

  it('keeps App as a lab value only where the declaration follows the app', () => {
    expect(labGlobals(following, undefined).mode).toBe(FOLLOW_APP);
    expect(labGlobals(following, { mode: FOLLOW_APP }).mode).toBe(FOLLOW_APP);
    expect(labGlobals(declarations, { mode: FOLLOW_APP }).mode).toBe('auto');
  });

  it('offers App first in the lab’s options, and never as a trial’s pin', () => {
    expect(labOptions(following.mode!, {}).map((option) => option.value)).toEqual([FOLLOW_APP, 'auto', 'light', 'dark']);
    expect(labOptions(declarations.mode!, {}).map((option) => option.value)).toEqual(['auto', 'light', 'dark']);
    const group = withGlobals(f.schema({}), following).nodes.$globals as ConfigBranch;
    const pins = (group.children.mode as ConfigNode<string>).annotations.options ?? [];
    expect(pins.map((option) => option.value)).toEqual(['lab', 'auto', 'light', 'dark']);
  });

  it('resolves App to what the app’s chrome says, leaving every other value alone', () => {
    expect(followApp(following, { mode: FOLLOW_APP, font: 'inter' }, { mode: 'dark' })).toEqual({ mode: 'dark', font: 'inter' });
    const picked = { mode: 'light', font: 'inter' };
    expect(followApp(following, picked, { mode: 'dark' })).toBe(picked);
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
