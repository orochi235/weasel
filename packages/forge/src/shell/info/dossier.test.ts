import { f, type ConfigSchema } from '@weasel-js/labkit/config';
import type { Instrument } from '@weasel-js/labkit';
import { describe, expect, it } from 'vitest';
import type { IndexEntry } from '../../story/types';
import { storyDossier } from './dossier';

const ENTRY: IndexEntry = {
  id: 'ui-slider--basic',
  title: 'ui/Slider',
  name: 'Basic',
  exportName: 'Basic',
  file: '/repo/packages/ui/src/Slider.stories.tsx',
};

/** An instrument carrying `nodes`, which is all the dossier reads of one. */
function instrumentWith(nodes: ConfigSchema<unknown>['nodes']): Instrument<unknown, unknown> {
  return {
    name: ENTRY.id,
    config: { nodes, defaults: () => ({}) },
    defaultConfig: () => ({}),
    initialState: () => null,
    render: () => null,
  };
}

describe('storyDossier', () => {
  it('carries identity straight off the index entry', () => {
    const dossier = storyDossier({
      entry: { ...ENTRY, componentName: 'Slider', description: 'The plain one.' },
    });
    expect(dossier).toMatchObject({
      id: 'ui-slider--basic',
      title: 'ui/Slider',
      exportName: 'Basic',
      file: ENTRY.file,
      componentName: 'Slider',
      description: 'The plain one.',
    });
  });

  it('says args are pending for a story whose frame has reported no schema', () => {
    const dossier = storyDossier({ entry: ENTRY });
    expect(dossier.args).toEqual([]);
    expect(dossier.argsPending).toBe(true);
  });

  it('pairs each leaf with the trial value, falling back to the default', () => {
    const nodes = {
      size: f.number(4).describe('How big.'),
      label: f.string('Go'),
    };
    const dossier = storyDossier({
      entry: ENTRY,
      instrument: instrumentWith(nodes),
      config: { size: 9 },
    });
    expect(dossier.argsPending).toBe(false);
    expect(dossier.args).toEqual([
      { path: 'size', label: 'size', kind: 'number', default: 4, value: 9, description: 'How big.' },
      { path: 'label', label: 'label', kind: 'string', default: 'Go', value: 'Go' },
    ]);
  });

  it('flattens a group into dotted paths and drops the lab globals', () => {
    const nodes = {
      grid: f.group({ size: f.number(8) }),
      $globals: f.group({ mode: f.string('dark') }),
    };
    const dossier = storyDossier({
      entry: ENTRY,
      instrument: instrumentWith(nodes),
      config: { grid: { size: 12 } },
    });
    expect(dossier.args.map((a) => a.path)).toEqual(['grid.size']);
    expect(dossier.args[0].value).toBe(12);
  });

  it('skips a hidden leaf', () => {
    const dossier = storyDossier({
      entry: ENTRY,
      instrument: instrumentWith({ seed: f.number(1).hidden(), size: f.number(2) }),
      config: {},
    });
    expect(dossier.args.map((a) => a.path)).toEqual(['size']);
  });
});
