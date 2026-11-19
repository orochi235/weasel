/// <reference types="vite/client" />
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { grownSince } from '@weasel-js/react/testing/leakProbe';
import { describeTeardown, storyCases } from './testing/teardown';
import { ActionSettingsPopover } from './components/ActionSettings';
import { useFontFamilyOptions, useFontWeightOptions } from './components/FontOptions';
import { createRecentColorsStore, RecentColorsProvider, useRecentColors } from './components/RecentColors';
import { RunScope, useRun } from './components/Run';

// The teardown harness (`./testing/teardown.tsx`) over the stories outside `components/`, the exports no story
// draws, and the stores that count their subscribers. `components/teardown.*.test.tsx` run the components' stories.

const SHARDED = /^\.\/components\/[A-Z]/;
const HERE = /^\.\/(color|cursors)\//;

it('runs every story file in the package in one teardown file or another', () => {
  const missed = Object.keys(import.meta.glob('./**/*.stories.tsx')).filter((f) => !SHARDED.test(f) && !HERE.test(f));
  expect(missed).toEqual([]);
});

function Hooks(): ReactNode {
  useFontFamilyOptions();
  useFontWeightOptions();
  useRecentColors();
  useRun();
  return <button type="button">hooks</button>;
}
const settings = {
  schema: { name: 'Snap Settings', children: { strict: { kind: 'boolean', name: 'Strict', description: '', default: false } } },
  values: { strict: true },
  mixed: new Set<string>(),
  onChange: () => {},
} as never;

const probe = describeTeardown(
  'every story and storyless export releases what it registered once unmounted',
  [
    ...(await storyCases(import.meta.glob(['./color/**/*.stories.tsx', './cursors/**/*.stories.tsx']))),
    ['ActionSettingsPopover', () => <ActionSettingsPopover settings={settings} label="Snap" />],
    ['RecentColorsProvider, FontOptions and Run hooks', () => <RecentColorsProvider><RunScope><Hooks /></RunScope></RecentColorsProvider>],
  ],
  7,
);

describe('every store releases what it registered once its last subscriber leaves', () => {
  it.each<[string, () => () => void]>([
    ['createRecentColorsStore, on localStorage', () => createRecentColorsStore().subscribe(() => {})],
  ])('%s', (_, subscribe) => {
    const before = probe().live();
    subscribe()();
    probe().flush();
    expect(grownSince(before, probe().live())).toEqual([]);
  });
});
