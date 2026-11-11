/**
 * Property test of path-tools' tool sets against the tools `usePathToolsTools` builds: every id a set names has a
 * tool of that id and every tool is in a set, and any ids cut from the sets leave the rest in order, with the warp
 * stack still one stack.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { renderHook } from '@testing-library/react';
import { toolIdsOf, toolStacksOf, withoutTools } from '@weasel-js/routing';
import { PATH_EDIT_TOOLS, PATH_TOOLS_TOOLS, RESHAPE_TOOLS, usePathEditTools, usePathToolsTools, WARP_TOOLS, type PathToolId } from './toolSets';
import { runs, timeoutFor } from './pbt.fixture';

const ALL = toolIdsOf([PATH_TOOLS_TOOLS]);

describe('path-tools tool sets, property', () => {
  it('name exactly the tools usePathToolsTools builds, each under its own id', () => {
    const { result } = renderHook(() => ({ all: usePathToolsTools(), edit: usePathEditTools() }));
    expect(Object.keys(result.current.all).sort()).toEqual([...ALL].sort());
    expect(new Set(ALL).size).toBe(ALL.length);
    for (const [key, tool] of Object.entries(result.current.all)) expect(tool.id, key).toBe(key);
    expect(Object.keys(result.current.edit).sort()).toEqual(toolIdsOf([PATH_EDIT_TOOLS]).sort());
    for (const id of toolIdsOf([PATH_EDIT_TOOLS])) {
      expect(result.current.all[id].eligibility?.capabilities, `${id} edits anchors`).toContain('edits-anchors');
    }
  });

  it('cut any ids and keep the rest in order, the warp tools still one stack', () => {
    fc.assert(fc.property(fc.subarray(ALL), (omit) => {
      for (const set of [PATH_TOOLS_TOOLS, RESHAPE_TOOLS, WARP_TOOLS]) {
        const cut = withoutTools(set, ...omit);
        const kept = toolIdsOf([set]).filter((id) => !omit.includes(id));
        expect(toolIdsOf([cut])).toEqual(kept);
        const warps = toolIdsOf([WARP_TOOLS]).filter((id) => kept.includes(id)) as PathToolId[];
        expect(toolStacksOf([cut]), set.id).toEqual(warps.length > 0 ? [warps] : []);
      }
    }), runs(200));
  }, timeoutFor(200, 2));
});
