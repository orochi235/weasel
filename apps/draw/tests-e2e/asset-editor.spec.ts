/**
 * Usability scenarios for the asset editor at `#/dev/assets`: what a person
 * editing the app's schemas does, driven with a real mouse and keyboard.
 *
 *   npm run test:e2e:draw -- asset-editor
 *   DRAW_E2E_URL=http://<node>.local:33452 npm run test:e2e:draw -- asset-editor
 */
import { test, expect, type Page } from '@playwright/test';

const tree = (page: Page) => page.getByRole('tree', { name: 'Schema structure' });
const row = (page: Page, name: string | RegExp) => tree(page).getByRole('treeitem', { name });
const attrs = (page: Page) => page.getByRole('region', { name: 'Attributes' });
const preview = (page: Page) => page.getByRole('region', { name: 'Live preview' });
const tool = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

const errors: string[] = [];

test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto('/weasel/draw/#/dev/assets');
  await expect(tree(page)).toBeVisible({ timeout: 30_000 });
});

test.afterEach(() => {
  expect(errors, 'console errors').toEqual([]);
});

test('renaming a pref updates the tree, the preview and the literal, and undoes in one step', async ({ page }) => {
  await row(page, /^Grid density/).click();
  const name = attrs(page).getByRole('textbox', { name: 'Name' });
  await name.fill('Grid spacing');
  await expect(row(page, /^Grid spacing/)).toBeVisible();
  await expect(preview(page).getByText('Grid spacing', { exact: false }).first()).toBeVisible();
  await expect(page.getByText("name: 'Grid spacing'")).toBeVisible();
  await tool(page, 'Undo').click();
  await expect(name).toHaveValue('Grid density');
});

test('Add pref asks for a name, a key and a kind, and lands the pref after the selection', async ({ page }) => {
  await row(page, /^Grid density/).click();
  await tool(page, 'Add pref').click();
  const dialog = page.getByRole('dialog', { name: 'Add pref' });
  await page.keyboard.type('Grid color');
  await expect(dialog.getByRole('textbox', { name: 'Key' })).toHaveValue('gridColor');
  const add = dialog.getByRole('button', { name: 'Add', exact: true });
  await expect(add).toBeDisabled();
  await dialog.getByRole('button', { name: /Kind/ }).click();
  await page.getByRole('option', { name: 'color', exact: true }).click();
  await add.click();
  await expect(dialog).toBeHidden();
  const added = row(page, /^Grid color/);
  await expect(added).toHaveAttribute('aria-selected', 'true');
  const names = await tree(page).getByRole('treeitem').evaluateAll((rows) => rows.map((r) => r.textContent ?? ''));
  const at = names.findIndex((n) => n.startsWith('Grid density'));
  expect(names[at + 1]).toMatch(/^Grid color/);
  // Focus goes back where the person was working, not to the page.
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
});

test('Remove takes the pref out and selects the row after it', async ({ page }) => {
  await row(page, /^Snap to grid/).click();
  await tool(page, 'Remove').click();
  await expect(row(page, /^Snap to grid/)).toHaveCount(0);
  await expect(row(page, /^Show path direction/)).toHaveAttribute('aria-selected', 'true');
  await tool(page, 'Undo').click();
  await expect(row(page, /^Snap to grid/)).toBeVisible();
});

test('Delete removes the pref and the selection lands where focus does', async ({ page }) => {
  await row(page, /^Snap to grid/).click();
  await page.keyboard.press('Delete');
  await expect(row(page, /^Snap to grid/)).toHaveCount(0);
  const next = row(page, /^Show path direction/);
  await expect(next).toHaveAttribute('aria-selected', 'true');
  await expect(next).toBeFocused();
});

test('the filter narrows the tree and clearing it brings every row back', async ({ page }) => {
  const all = await tree(page).getByRole('treeitem').count();
  const filter = page.getByRole('textbox', { name: 'Filter structure' });
  await filter.fill('grid');
  await expect.poll(() => tree(page).getByRole('treeitem').count()).toBeLessThan(all);
  await expect(row(page, /^Grid density/)).toBeVisible();
  await expect(row(page, /^Symmetry axis/)).toHaveCount(0);
  await filter.fill('');
  await expect.poll(() => tree(page).getByRole('treeitem').count()).toBe(all);
});

test('arrow keys walk the tree and the attributes follow', async ({ page }) => {
  await row(page, /^Show grid/).click();
  await page.keyboard.press('ArrowDown');
  await expect(row(page, /^Grid density/)).toHaveAttribute('aria-selected', 'true');
  await expect(attrs(page).getByRole('textbox', { name: 'Name' })).toHaveValue('Grid density');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(tree(page).locator('[role=treeitem][aria-selected=true]')).toHaveCount(2);
});

test('the Changes tab lists an edit', async ({ page }) => {
  await row(page, /^Grid density/).click();
  await attrs(page).getByRole('textbox', { name: 'Description' }).fill('How far apart the grid lines are.');
  await page.getByRole('tab', { name: 'Changes' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Changes' })).toContainText('view/gridDensity.description');
});

for (const asset of ['Node: rect', 'Arrange', 'Menu bar', 'Selection']) {
  test(`opening ${asset} draws its structure and preview`, async ({ page }) => {
    await page.getByRole('listbox', { name: 'Assets' }).getByRole('option', { name: asset, exact: true }).click();
    await expect.poll(() => tree(page).getByRole('treeitem').count()).toBeGreaterThan(0);
    await tree(page).getByRole('treeitem').first().click();
    await expect(attrs(page).getByRole('textbox', { name: 'Name' })).toBeVisible();
  });
}

test('in a narrower window the panes give way rather than run off the edge', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 760 });
  const editor = page.getByRole('group', { name: 'Schema tools' }).locator('..');
  await expect.poll(() => editor.evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0);
  await expect(tool(page, 'Preferences')).toBeInViewport({ ratio: 1 });
  // The preview's rows stack once two across would not fit.
  const [a, b] = await Promise.all(['Right sidebar width', 'Left sidebar width'].map((name) =>
    preview(page).getByRole('spinbutton', { name }).or(preview(page).getByRole('textbox', { name })).first().boundingBox()));
  expect(a!.y + a!.height <= b!.y || b!.x >= a!.x + a!.width).toBe(true);
});

test('every pane fits the window, and the page does not scroll', async ({ page }) => {
  const scroll = await page.evaluate(() => { window.scrollTo(0, 5000); return window.scrollY; });
  expect(scroll).toBe(0);
});
