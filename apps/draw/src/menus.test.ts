/** Draw's context menus extend the editor's, which `<EditorShell>` installs ahead of the canvas's own ambient. */
import { describe, expect, it } from 'vitest';
import { EDITOR_CONTEXT_MENUS } from '@weasel-js/editor';
import { isPrefLeaf, type PrefGroup } from '@weasel-js/prefs';
import { mergeMenuDefs, pickMenu } from '@weasel-js/routing';
import { DRAW_MENUS } from './menus';

const live = mergeMenuDefs([...EDITOR_CONTEXT_MENUS, ...DRAW_MENUS].map((def) => ({ def, owner: null })), null);

const actions = (g: PrefGroup): string[] => Object.values(g.children).flatMap((c) => {
  if (!isPrefLeaf(c)) return actions(c);
  return c.kind === 'action' && 'action' in c && c.action ? [c.action] : [];
});

describe('draw context menus', () => {
  it("offers the enter items after the editor's selection menu", () => {
    const menu = pickMenu(live, { bodyTarget: 'selected-body' })!;
    expect(menu.id).toBe('editor.selection');
    expect(actions(menu.menu).slice(-2)).toEqual(['enterPathEdit', 'enterTextEdit']);
    expect(actions(menu.menu)).toContain('clipboard.cut');
  });

  it("leaves the empty canvas the editor's menu", () => {
    const menu = pickMenu(live, { bodyTarget: 'empty' })!;
    expect(menu.id).toBe('editor.canvas');
    expect(actions(menu.menu)).toEqual(['clipboard.paste', 'selectAll', 'undo', 'redo']);
  });
});
