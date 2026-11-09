import { describe, expect, it } from 'vitest';
import { actionBindings, browserReservedChord, modeShortcutSpec } from '@weasel-js/routing';
import { key, type KeySpec } from '@weasel-js/gestures';
import { DOC_CLIPBOARD_KEYS, EDITOR_PREFERENCES_KEY, FILE_KEYS, SNAPPING_KEY } from '@weasel-js/editor';
import { DEFAULT_MODES, shortcutOn } from '@weasel-js/modes';
import * as pathTools from '@weasel-js/path-tools';
import { LENS_KEYS, LOUPE_LEADER } from '@weasel-js/labkit/loupe';
import * as defaults from './defaults';

import type { Action } from '@weasel-js/routing';

// The menu bar's access keys are checked beside it, in `@weasel-js/ui`.

/** `owner: mods+key` for each of `specs` a browser takes first, on an Apple platform or not (default: this one). */
function reserved(owner: string, specs: readonly unknown[], apple?: boolean): string[] {
  return specs.flatMap((spec) => {
    const s = spec as KeySpec;
    if (s.kind !== 'key') return [];
    const hit = browserReservedChord(s, apple);
    return hit ? [`${owner}: ${JSON.stringify(s.mods ?? {})}+${hit.key}`] : [];
  });
}

function actionsIn(module: Record<string, unknown>): Action[] {
  return Object.values(module).filter(
    (v): v is Action => typeof v === 'object' && v !== null && 'id' in v && 'invoker' in v,
  );
}

const ofActions = (actions: readonly Action[]): string[] =>
  actions.flatMap((a) => reserved(a.id, actionBindings(a).map((b) => b.spec)));

describe('kit key bindings a browser reserves', () => {
  it("has no collision in core's default actions", () => {
    const actions = actionsIn(defaults);
    expect(actions.length).toBeGreaterThan(0);
    expect(ofActions(actions)).toEqual([]);
  });

  it("has no collision in path-tools' actions", () => {
    const actions = actionsIn(pathTools);
    expect(actions.length).toBeGreaterThan(0);
    expect(ofActions(actions)).toEqual([]);
  });

  it("has no collision in labkit's loupe keys", () => {
    expect([
      ...reserved('loupe.leader', [LOUPE_LEADER]),
      ...Object.entries(LENS_KEYS).flatMap(([id, k]) => reserved(id, [key(k!)])),
    ]).toEqual([]);
  });

  it("has no collision in editor's command keys or the default modes' shortcuts", () => {
    const editor = [
      ...Object.entries(FILE_KEYS).flatMap(([slot, spec]) => reserved(`FILE_KEYS.${slot}`, [spec])),
      ...Object.entries(DOC_CLIPBOARD_KEYS).flatMap(([slot, spec]) => reserved(`DOC_CLIPBOARD_KEYS.${slot}`, [spec])),
      ...reserved('EDITOR_PREFERENCES_KEY', [EDITOR_PREFERENCES_KEY]),
      ...reserved('SNAPPING_KEY', [SNAPPING_KEY]),
    ];
    const roles = ['entry', 'exit', 'discard', 'commit', 'cancel'] as const;
    const modes = [false, true].flatMap((apple) => DEFAULT_MODES.flatMap((mode) => roles.flatMap((role) => {
      const shortcut = shortcutOn(mode[role]?.shortcut, apple);
      return shortcut ? reserved(`${mode.id}.${role}`, [modeShortcutSpec(shortcut)], apple) : [];
    })));
    expect([...editor, ...modes]).toEqual([]);
  });
});
