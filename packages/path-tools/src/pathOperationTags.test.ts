import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Action } from '@weasel-js/routing';
import { actionsTagged, PATH_GESTURE_TAGS, pathsPreset, sliceAction, type FeaturePreset } from '@weasel-js/core';
import { pathTools } from './presets';
import {
  createAddPinAction, createRemovePinAction, createWarpDragAction, createWarpGrabAction,
} from './warp/warpActions';
import type { WarpKind } from './warp/warpTargets';

const DOC = readFileSync(join(__dirname, '../../../docs/path-operations.md'), 'utf8');

/** Each section's `Tag:` line and the action ids in its table. */
function docSections(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const section of DOC.split(/^## /m).slice(1)) {
    const tag = /^Tag: `([^`]+)`/m.exec(section)?.[1];
    if (!tag) continue;
    const ids = section.split('\n')
      .filter((line) => line.startsWith('|') && !line.startsWith('|---'))
      .slice(1)
      .flatMap((line) => [...(line.split('|')[2] ?? '').matchAll(/`([^`]+)`/g)].map((m) => m[1]));
    out.set(tag, ids);
  }
  return out;
}

function presetActions(preset: FeaturePreset): Action[] {
  return [...(preset.actions ?? []), ...(preset.includes ?? []).flatMap(presetActions)];
}

const WARPS: WarpKind[] = ['distort', 'envelope', 'puppet'];

/** Core's `paths` preset and the slice tool, `pathTools`, and the warp tools'
 *  own actions: everything that can carry a path operation. */
const ALL: Action[] = [
  ...presetActions(pathsPreset), sliceAction,
  ...presetActions(pathTools),
  ...WARPS.flatMap((k) => [createWarpDragAction(k), createWarpGrabAction(k)]),
  createAddPinAction(), createRemovePinAction(),
];

const idsTagged = (tag: string) => [...new Set(actionsTagged(ALL, tag).map((a) => a.id))].sort();

describe('path operation tags', () => {
  const sections = docSections();

  it('docs/path-operations.md names one tag per family, and every family', () => {
    const { path, ...families } = PATH_GESTURE_TAGS;
    expect([...sections.keys()].sort()).toEqual(Object.values(families).sort());
    expect(path).toBe('path');
  });

  it.each([...sections])('%s gathers exactly its section of docs/path-operations.md', (tag, ids) => {
    expect(idsTagged(tag)).toEqual([...ids].sort());
  });

  it('path gathers every operation the doc lists', () => {
    expect(idsTagged(PATH_GESTURE_TAGS.path)).toEqual([...sections.values()].flat().sort());
  });
});
