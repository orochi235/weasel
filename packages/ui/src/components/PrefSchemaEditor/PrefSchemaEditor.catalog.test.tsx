import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { actionCatalog } from './actionCatalog';
import type { EditorAction } from './editorActions';
import { PrefSchemaEditor, type PrefSchemaEditorProps } from './PrefSchemaEditor';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const ACTIONS: readonly EditorAction[] = [
  { key: 'edit.copy', label: 'Copy' },
  { key: 'edit.paste', label: 'Paste' },
  { key: 'save', label: 'Save' },
];
const SCHEMA: PrefGroup = { name: 'Prefs', children: { view: { name: 'View', children: {} } } };

const list = () => screen.getByRole('tree', { name: 'Actions' });
const pickAction = (id: string) => fireEvent.click(list().querySelector(`[data-tree-id="${id}"] > :first-child`)!);
const name = () => within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Name' }) as HTMLInputElement;
const under = (group: PrefGroup, key: string) => (group.children[key] as PrefGroup).children;

function Live({ onSchema, ...rest }: { onSchema?(next: PrefGroup): void } & Partial<PrefSchemaEditorProps>) {
  const [schema, setSchema] = useState(SCHEMA);
  return <PrefSchemaEditor schema={schema} onChange={(next) => { setSchema(next); onSchema?.(next); }} actions={ACTIONS} {...rest} />;
}

describe('PrefSchemaEditor: the catalog of actions', () => {
  it('takes an edit to an action, and hands the catalog to the host and nothing to the schema', () => {
    const onCatalog = vi.fn();
    const onSchema = vi.fn();
    renderWithIcons(<Live onActionCatalogChange={onCatalog} onSchema={onSchema} />);
    pickAction('edit/editCopy');
    expect(name().closest('fieldset:disabled')).toBeNull();
    fireEvent.change(name(), { target: { value: 'Duplicate' } });
    expect(under(onCatalog.mock.lastCall![0] as PrefGroup, 'edit').editCopy).toMatchObject({ name: 'Duplicate', action: 'edit.copy' });
    expect(onSchema).not.toHaveBeenCalled();
    expect(name().value).toBe('Duplicate');
  });

  it('starts from the catalog the host kept', () => {
    const kept = actionCatalog(ACTIONS);
    const renamed: PrefGroup = { ...kept, children: { ...kept.children, edit: { ...(kept.children.edit as PrefGroup), name: 'Editing' } } };
    renderWithIcons(<Live actionCatalog={renamed} />);
    pickAction('edit');
    expect(name().value).toBe('Editing');
  });

  it('keeps an edit to the catalog in the draft, with its step', () => {
    renderWithIcons(<Live draftKey="catalog-draft" />);
    pickAction('edit/editCopy');
    fireEvent.change(name(), { target: { value: 'Duplicate' } });
    cleanup();
    renderWithIcons(<Live draftKey="catalog-draft" />);
    pickAction('edit/editCopy');
    expect(name().value).toBe('Duplicate');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    pickAction('edit/editCopy');
    expect(name().value).toBe('Copy');
  });

  it('opens a draft kept before the catalog was, on the schema it holds', () => {
    renderWithIcons(<PrefSchemaEditor schema={SCHEMA} onChange={() => {}} draftKey="old-draft" />);
    fireEvent.click(within(screen.getByRole('tree', { name: 'Schema structure' })).getByText('view'));
    fireEvent.change(name(), { target: { value: 'Seen' } });
    cleanup();
    renderWithIcons(<Live draftKey="old-draft" />);
    expect(within(screen.getByRole('tree', { name: 'Schema structure' })).getByText('Seen')).toBeTruthy();
  });
});
