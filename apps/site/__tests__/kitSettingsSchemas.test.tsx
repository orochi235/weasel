import { cleanup, render } from '@testing-library/react';
import { coreKitSettingsSchema } from '@weasel-js/core';
import { kernel3dKitSettingsSchema } from '@weasel-js/kernel3d';
import { labkitKitSettingsSchema } from '@weasel-js/labkit';
import {
  mergePrefGroups, openPrefsSync, prefLeaves, type PrefEnum, type PrefLeaf, type PrefNumber, type PrefPath,
} from '@weasel-js/prefs';
import { KitSettingsFromPrefs, usePrefsValues } from '@weasel-js/prefs/react';
import { useKitSettings, type KitSettingPath } from '@weasel-js/react';
import { rigKitSettingsSchema } from '@weasel-js/rig';
import { createMemoryAdapter } from '@weasel-js/storage';
import { PrefsForm } from '@weasel-js/ui/components/Prefs';
import { uiKitSettingsSchema } from '@weasel-js/ui/kit-settings';
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { renderWithIcons } from '../testIcons';

afterEach(cleanup);

const SCHEMAS = [uiKitSettingsSchema, coreKitSettingsSchema, rigKitSettingsSchema, kernel3dKitSettingsSchema, labkitKitSettingsSchema] as const;
type Declared = { [I in keyof typeof SCHEMAS]: PrefPath<(typeof SCHEMAS)[I]> }[number];

const ALL = mergePrefGroups('Kit settings', ...SCHEMAS);
const LEAVES = [...prefLeaves(ALL)];
const PREFIX = 'kit.';

/** A value the leaf holds that is not its default. */
function other(leaf: PrefLeaf): unknown {
  if (leaf.kind === 'boolean') return !leaf.default;
  if (leaf.kind === 'enum') return (leaf as PrefEnum).options.find((o) => o.value !== leaf.default)!.value;
  if (leaf.kind === 'number') {
    const { min, max, default: d } = leaf as PrefNumber & { default: number };
    return max !== undefined && max !== d ? max : min !== undefined && min !== d ? min : d + 1;
  }
  throw new Error(`no other value for a ${leaf.kind} kit setting`);
}

describe("the bundled packages' kit settings schemas", () => {
  it('declare every KitSettings path between them, and nothing else', () => {
    expectTypeOf<Declared>().toEqualTypeOf<KitSettingPath>();
  });

  it('declare each path once', () => {
    const counts = new Map<string, number>();
    for (const schema of SCHEMAS) for (const path of prefLeaves(schema).keys()) counts.set(path, (counts.get(path) ?? 0) + 1);
    expect([...counts].filter(([, n]) => n > 1)).toEqual([]);
  });

  it('keep a value at every leaf through storage, and a reopened store hands each to useKitSettings', async () => {
    const backing = new Map<string, unknown>();
    const store = openPrefsSync(ALL, { storage: createMemoryAdapter(backing), prefix: PREFIX });
    for (const [path, leaf] of LEAVES) store.set(path, other(leaf));
    expect(await store.flush()).toBe(true);

    const again = openPrefsSync(ALL, { storage: createMemoryAdapter(backing), prefix: PREFIX });
    let read: ((path: string) => unknown) | undefined;
    function Probe() {
      const settings = useKitSettings();
      read = settings.get as (path: string) => unknown;
      return null;
    }
    render(<KitSettingsFromPrefs store={again}><Probe /></KitSettingsFromPrefs>);
    expect(Object.fromEntries(LEAVES.map(([path]) => [path, read!(path)])))
      .toEqual(Object.fromEntries(LEAVES.map(([path, leaf]) => [path, other(leaf)])));
  });

  it('draw a row for every leaf in a form bound to their store', () => {
    const store = openPrefsSync(ALL, { storage: createMemoryAdapter(), prefix: PREFIX });
    function Form() {
      return <PrefsForm layout="list" {...usePrefsValues(store).form} />;
    }
    const { container } = renderWithIcons(<Form />);
    const missing = LEAVES.map(([path]) => path).filter((path) => !container.querySelector(`[data-pref-path="${path}"]`));
    expect(missing).toEqual([]);
  });
});
