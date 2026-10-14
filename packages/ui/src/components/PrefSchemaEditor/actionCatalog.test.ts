import { describe, expect, it } from 'vitest';
import type { PrefGroup } from '@weasel-js/prefs';
import { actionCatalog, dissolve, filed, keyTails } from './actionCatalog';
import { actionLeaf, type EditorAction } from './editorActions';

const UNDO: EditorAction = { key: 'edit.undo', label: 'Undo' };
const REDO: EditorAction = { key: 'edit.redo', label: 'Redo' };
const SNAP: EditorAction = { key: 'view.snap', label: 'Snap' };
const SAVE: EditorAction = { key: 'save', label: 'Save' };
const LEFT: EditorAction = { key: 'align:left', label: 'Align left' };
const DEEP: EditorAction = { key: 'view.grid.show', label: 'Show grid' };
const ACTIONS = [UNDO, SAVE, SNAP, REDO];

const group = (name: string, children: PrefGroup['children']): PrefGroup => ({ name, description: '', children });

describe('actionCatalog', () => {
  it('files each action under a group for each part of its key but the last, and one-part keys after the groups', () => {
    const catalog = actionCatalog(ACTIONS);
    expect(catalog).toEqual(group('Actions', {
      edit: group('Edit', { editUndo: actionLeaf(UNDO), editRedo: actionLeaf(REDO) }),
      view: group('View', { viewSnap: actionLeaf(SNAP) }),
      save: actionLeaf(SAVE),
    }));
    expect(Object.keys(catalog.children)).toEqual(['edit', 'view', 'save']);
  });

  it('nests a group for each further part, and files a variant under its action', () => {
    const catalog = actionCatalog([DEEP, LEFT]);
    expect(((catalog.children.view as PrefGroup).children.grid as PrefGroup).children).toEqual({ viewGridShow: actionLeaf(DEEP) });
    expect((catalog.children.align as PrefGroup).children).toEqual({ alignLeft: actionLeaf(LEFT) });
  });

  it('lists an action given twice once', () => {
    expect(Object.keys(actionCatalog([SAVE, SAVE]).children)).toEqual(['save']);
  });
});

describe('filed', () => {
  it('is the catalog itself where a pref fires every action', () => {
    const catalog = actionCatalog(ACTIONS);
    expect(filed(catalog, ACTIONS)).toBe(catalog);
  });

  it('leaves an action where the reader put it, under whatever name', () => {
    const catalog = group('Actions', { history: group('History', { back: { ...actionLeaf(UNDO), name: 'Step back' } }) });
    expect(filed(catalog, [UNDO])).toBe(catalog);
  });

  it('adds an action no pref fires to the group its key names, after what the group holds', () => {
    const catalog = group('Actions', { edit: group('Editing', { editUndo: actionLeaf(UNDO) }) });
    const next = filed(catalog, [UNDO, REDO, SAVE]);
    expect(Object.keys((next.children.edit as PrefGroup).children)).toEqual(['editUndo', 'editRedo']);
    expect(Object.keys(next.children)).toEqual(['edit', 'save']);
  });

  it('gives a new group and a new pref keys nothing beside them has, and finds the group again', () => {
    const catalog = group('Actions', { edit: actionLeaf({ key: 'old', label: 'Edit' }), save: group('Saving', {}) });
    const next = filed(catalog, [UNDO, SAVE, REDO]);
    expect(Object.keys(next.children)).toEqual(['edit', 'save', 'edit2', 'save2']);
    expect(Object.keys((next.children.edit2 as PrefGroup).children)).toEqual(['editUndo', 'editRedo']);
  });
});

describe('keyTails', () => {
  it('shows a group the part of the key its actions share, and each pref the rest', () => {
    const tails = keyTails(actionCatalog([UNDO, REDO, DEEP, SNAP, LEFT, SAVE]));
    expect(Object.fromEntries(tails)).toEqual({
      edit: 'edit', 'edit/editUndo': 'undo', 'edit/editRedo': 'redo',
      view: 'view', 'view/grid': 'grid', 'view/grid/viewGridShow': 'show', 'view/viewSnap': 'snap',
      align: 'align', 'align/alignLeft': 'left',
      save: 'save',
    });
  });

  it('shows a group of actions from all over nothing, and its prefs their whole keys', () => {
    const tails = keyTails(group('Actions', { mine: group('Mine', { a: actionLeaf(UNDO), b: actionLeaf(SNAP) }), empty: group('Empty', {}) }));
    expect(Object.fromEntries(tails)).toEqual({ mine: '', 'mine/a': 'edit.undo', 'mine/b': 'view.snap', empty: '' });
  });

  it('leaves a lone pref a part of its key to show', () => {
    const tails = keyTails(group('Actions', { history: group('History', { a: actionLeaf(UNDO) }) }));
    expect(Object.fromEntries(tails)).toEqual({ history: 'edit', 'history/a': 'undo' });
  });
});

describe('dissolve', () => {
  const catalog = group('Actions', {
    edit: group('Edit', { editUndo: actionLeaf(UNDO), gone: actionLeaf({ key: 'old.gone', label: 'Gone' }) }),
    viewSnap: actionLeaf(SNAP),
  });
  const live = new Set(['edit.undo', 'view.snap']);

  it('sets what a group holds where the group was', () => {
    const next = dissolve(catalog, ['edit'], live);
    expect(Object.keys(next.children)).toEqual(['editUndo', 'gone', 'viewSnap']);
  });

  it('removes a pref whose action is gone, and leaves one whose action is registered', () => {
    expect(Object.keys((dissolve(catalog, ['edit/gone'], live).children.edit as PrefGroup).children)).toEqual(['editUndo']);
    expect(dissolve(catalog, ['edit/editUndo', 'viewSnap'], live)).toBe(catalog);
  });

  it('keeps a lifted pref’s key off the ones already there', () => {
    const clash = group('Actions', { editUndo: actionLeaf(SNAP), edit: group('Edit', { editUndo: actionLeaf(UNDO) }) });
    expect(Object.keys(dissolve(clash, ['edit'], live).children)).toEqual(['editUndo', 'editUndo2']);
  });
});
