import '@weasel-js/theme/tokens.css';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { useState } from 'react';
import type { PrefAlias, PrefGroup } from '@weasel-js/prefs';
import { AssetEditor } from './AssetEditor';
import { DEMO_WORKSPACE } from './AssetEditor.demo';
import { drag, grip, pointer, pointIn, type Point } from './pointerDrag.fixture';
import { keyedRow } from './treeRows.fixture';
import type { Workspace } from './workspace';
import { workspaceCodec } from './workspaceCodec';
import { renderWithIcons } from '../../testing/withIcons';

// Where the asset list sits and what its rows look like is the grid's and the stylesheet's doing, and whether a
// drop is taken is read off real boxes; jsdom lays nothing out.

beforeAll(() => page.viewport(1500, 800));
afterEach(cleanup);

const codec = workspaceCodec([]);
let latest: Workspace = DEMO_WORKSPACE;
function Live({ start = DEMO_WORKSPACE }: { start?: Workspace }) {
  const [workspace, setWorkspace] = useState(start);
  latest = workspace;
  return <div style={{ width: 1460, height: 700 }}><AssetEditor list workspace={workspace} codec={codec} onChange={setWorkspace} /></div>;
}

const box = (el: Element): DOMRect => el.getBoundingClientRect();
const list = () => screen.getByRole('listbox', { name: 'Assets' });
const option = (label: string) => within(list()).getByRole('option', { name: new RegExp(`^${label}`) });
const labelOf = (row: HTMLElement) => row.children[1] as HTMLElement;
const structure = () => screen.getByRole('tree', { name: 'Schema structure' });
const treeRow = (key: string) =>
  keyedRow(structure(), key)!.firstElementChild as HTMLElement;
const preview = () => screen.getByRole('region', { name: 'Live preview' });
const rootOf = (id: string) => latest.assets.find((a) => a.id === id)!.root as PrefGroup;
const overlap = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

test('the asset list fills the editor\'s far column, beside the preview and the export under it', () => {
  const { container } = renderWithIcons(<Live />);
  const editor = box(container.firstElementChild!.firstElementChild!);
  const aside = box(screen.getByRole('complementary', { name: 'Sidebar' }));
  const bar = box(screen.getByRole('group', { name: 'Schema tools' }));
  expect(aside.left).toBeGreaterThanOrEqual(box(preview()).right);
  expect(aside.left).toBeGreaterThanOrEqual(box(screen.getByRole('region', { name: 'Export' })).right);
  expect(Math.abs(aside.right - editor.right)).toBeLessThan(2);
  expect(aside.top).toBeGreaterThanOrEqual(bar.bottom);
  expect(Math.abs(aside.bottom - editor.bottom)).toBeLessThan(2);
  expect(aside.width).toBe(240);
  const rows = box(list());
  expect(rows.left).toBeGreaterThanOrEqual(aside.left);
  expect(rows.right).toBeLessThanOrEqual(aside.right);
  // Each kind's heading sits over its own assets.
  expect(box(within(list()).getByText('Dialogs')).bottom).toBeLessThanOrEqual(box(option('Settings')).top);
  expect(box(within(list()).getByText('Panels')).top).toBeGreaterThanOrEqual(box(option('Settings')).bottom);
  expect(box(within(list()).getByText('Panels')).bottom).toBeLessThanOrEqual(box(option('Canvas')).top);
});

test('every row of the list is one line tall, a lock set after its label and not over it', () => {
  renderWithIcons(<Live />);
  const rows = within(list()).getAllByRole('option');
  expect(rows).toHaveLength(3);
  const height = box(rows[0]!).height;
  for (const row of rows) {
    expect(box(row).height).toBe(height);
    expect(box(labelOf(row)).height).toBeLessThan(2 * parseFloat(getComputedStyle(labelOf(row)).fontSize));
  }
  const locked = option('Export');
  const lock = box(within(locked).getByRole('img', { name: 'Dynamic' }));
  expect(lock.left).toBeGreaterThanOrEqual(box(labelOf(locked)).right);
  expect(lock.right).toBeLessThanOrEqual(box(locked).right);
  expect(lock.top).toBeGreaterThanOrEqual(box(locked).top);
  expect(lock.bottom).toBeLessThanOrEqual(box(locked).bottom);
});

test('a label too long for the list is cut short on its one line, and its lock stays in the row', () => {
  const long: Workspace = { assets: DEMO_WORKSPACE.assets.map((a) => (a.id === 'export' ? { ...a, label: 'Export, as the file menu and the toolbar both lay it out' } : a)) };
  renderWithIcons(<Live start={long} />);
  const row = option('Export');
  const lock = box(within(row).getByRole('img', { name: 'Dynamic' }));
  expect(box(row).height).toBe(box(option('Settings')).height);
  expect(labelOf(row).scrollWidth).toBeGreaterThan(labelOf(row).clientWidth);
  expect(overlap(lock, box(labelOf(row)))).toBe(false);
  expect(lock.right).toBeLessThanOrEqual(box(row).right);
});

test('a changed asset\'s label takes the color of a changed row in the tree, and moves nothing', () => {
  renderWithIcons(<Live />);
  const before = { settings: box(labelOf(option('Settings'))), exported: box(labelOf(option('Export'))), lock: box(within(option('Export')).getByRole('img')) };
  const plain = getComputedStyle(labelOf(option('Canvas'))).color;
  // Removing a setting changes the dialog and the panel that pointed at it.
  fireEvent.click(within(structure()).getByText('scale'));
  fireEvent.keyDown(structure(), { key: 'Delete' });
  expect(option('Settings')).toHaveAttribute('data-changed');
  expect(option('Export')).toHaveAttribute('data-changed');
  expect(option('Canvas')).not.toHaveAttribute('data-changed');
  const changed = getComputedStyle(labelOf(option('Export'))).color;
  expect(changed).not.toBe(plain);
  // The asset shown is filled in the accent, where that color would not read: its label takes one that does.
  const shown = getComputedStyle(labelOf(option('Settings'))).color;
  expect(shown).not.toBe(changed);
  expect(shown).not.toBe(getComputedStyle(option('Settings')).color);
  expect(getComputedStyle(labelOf(option('Canvas'))).color).toBe(plain);
  fireEvent.click(within(structure()).getByText('format'));
  fireEvent.change(within(screen.getByRole('region', { name: 'Attributes' })).getByRole('textbox', { name: 'Name' }), { target: { value: 'File type' } });
  expect(getComputedStyle(within(structure()).getByText('File type')).color).toBe(changed);
  expect(box(labelOf(option('Settings')))).toEqual(before.settings);
  expect(box(labelOf(option('Export')))).toEqual(before.exported);
  expect(box(within(option('Export')).getByRole('img'))).toEqual(before.lock);
});

test('picking an asset leaves the list where it was, at the size it was', () => {
  renderWithIcons(<Live />);
  const before = box(list());
  const rows = () => within(list()).getAllByRole('option').map(box);
  const were = rows();
  for (const label of ['Canvas', 'Export', 'Settings']) {
    fireEvent.click(option(label));
    expect(option(label)).toHaveAttribute('aria-selected', 'true');
    expect(box(list())).toEqual(before);
    expect(rows()).toEqual(were);
  }
});

test('a panel\'s preview draws its pointers as the dialog\'s settings, its own rows among its sections\'', () => {
  renderWithIcons(<Live />);
  fireEvent.click(option('Canvas'));
  const zoom = box(within(preview()).getByText('Zoom step'));
  const grid = box(within(preview()).getByText('Show grid'));
  expect(zoom.width).toBeGreaterThan(0);
  expect(grid.top).toBeGreaterThanOrEqual(zoom.bottom);
  // Two rows across: the section's second pointer sits beside its first.
  const snap = box(within(preview()).getByText('Snap'));
  expect(snap.top).toBe(grid.top);
  expect(snap.left).toBeGreaterThan(grid.right);
});

test('a pointer dragged in a panel\'s tree moves in the panel, and still points where it did', () => {
  renderWithIcons(<Live />);
  fireEvent.click(option('Canvas'));
  drag(treeRow('snap'), pointIn(treeRow('grid'), 0.5, 0.1));
  const section = rootOf('canvas').children.lines as PrefGroup;
  expect(Object.keys(section.children)).toEqual(['snap', 'grid']);
  expect((section.children.snap as PrefAlias).of).toBe('view.snap');
  expect(rootOf('settings')).toBe(DEMO_WORKSPACE.assets[0]!.root);
});

/** Carry `from` over `to` and hold it there; what this returns lets go. */
function hold(from: HTMLElement, to: Point): () => void {
  const press = grip(from);
  act(() => pointer('pointerdown', from, press));
  for (let i = 1; i <= 8; i++) act(() => pointer('pointermove', document, { x: press.x + ((to.x - press.x) * i) / 8, y: press.y + ((to.y - press.y) * i) / 8 }));
  act(() => pointer('pointermove', document, to));
  return () => act(() => pointer('pointerup', document, to));
}
/** The rows the preview draws, in order, with `held` where the form draws the dragged one: where it would land, or where it sits. */
const drawn = () => [...preview().querySelectorAll('[data-pref-path], [data-drop-placeholder]')].map((el) => el.getAttribute('data-pref-path') ?? 'held');
const dragTool = (name: string) => within(screen.getByRole('group', { name: 'Drag to add' })).getByRole('button', { name });

test('a read-only panel marks no place to drop, in its tree or in its preview, and takes nothing let go there', () => {
  renderWithIcons(<Live />);
  fireEvent.click(option('Export'));
  const rows = drawn();
  let release = hold(treeRow('scale'), pointIn(treeRow('format'), 0.5, 0.1));
  expect(structure().querySelector('[data-drop]')).toBeNull();
  release();
  release = hold(treeRow('scale'), pointIn(within(preview()).getByText('Format'), 0.5, 0.1));
  // Held over the row above it, the dragged row is drawn where it sits and not where it was carried.
  expect(drawn()).toEqual(rows.map((path) => (path === 'scale' ? 'held' : path)));
  release();
  release = hold(within(preview()).getByText('Scale'), pointIn(within(preview()).getByText('Format'), 0.5, 0.1));
  expect(drawn()).toEqual(rows.map((path) => (path === 'scale' ? 'held' : path)));
  expect(structure().querySelector('[data-drop]')).toBeNull();
  release();
  expect(dragTool('Separator')).toBeDisabled();
  expect(latest).toBe(DEMO_WORKSPACE);
  // Where its pointer points is shown, and takes no press.
  fireEvent.click(within(structure()).getByText('format'));
  const attributes = screen.getByRole('region', { name: 'Attributes' });
  const of = within(attributes).getByRole('button', { name: /Format \(export\.format\)/ });
  expect(of.matches(':disabled')).toBe(true);
  const at = pointIn(of, 0.5);
  expect(attributes.querySelector('fieldset')!.contains(document.elementFromPoint(at.x, at.y))).toBe(false);
});

test('the same drags over a panel that takes edits mark where they would land, and land', () => {
  renderWithIcons(<Live />);
  fireEvent.click(option('Canvas'));
  let release = hold(treeRow('snap'), pointIn(treeRow('zoomStep'), 0.5, 0.1));
  expect(structure().querySelector('[data-drop]')).not.toBeNull();
  release();
  expect(Object.keys(rootOf('canvas').children)).toEqual(['snap', 'zoomStep', 'lines']);
  const rows = drawn();
  release = hold(treeRow('zoomStep'), pointIn(within(preview()).getByText('Snap'), 0.5, 0.1));
  expect(rows.indexOf('zoomStep')).toBe(1);
  expect(drawn().indexOf('held')).toBe(0);
  release();
  expect(Object.keys(rootOf('canvas').children)).toEqual(['zoomStep', 'snap', 'lines']);
});
