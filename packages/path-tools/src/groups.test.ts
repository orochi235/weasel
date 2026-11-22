import { describe, expect, it } from 'vitest';
import * as editingGroups from '@weasel-js/editing/groups';
import * as pathToolsGroups from './groups';
import * as featurePresets from './featurePresets';
import * as pathsPresets from './pathsPreset';

const presets = [...Object.values(featurePresets), ...Object.values(pathsPresets)]
  .flatMap((p) => (typeof p === 'object' && p && 'actions' in p ? [p as { actions?: readonly { id: string; group?: string }[] }] : []));

describe('@weasel-js/path-tools/groups', () => {
  it('names the group of every action a preset ships, or editing does', () => {
    const named = new Set<string>([...Object.values(editingGroups), ...Object.values(pathToolsGroups)].filter((g) => typeof g === 'string'));
    const unnamed = presets.flatMap((p) => p.actions ?? []).filter((a) => a.group && !named.has(a.group)).map((a) => `${a.id}: ${a.group}`);
    expect([...new Set(unnamed)]).toEqual([]);
  });
});
