import '@weasel-js/theme/tokens.css';
import './ContextMenuHost.browser.test.css';
import { pref } from '@weasel-js/prefs';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { ActionDisabledReason, ActionsProvider, useAction, useMenuHost, useMenus, type MenuDef, type MenuHost } from '@weasel-js/core';
import { OverlayPortalProvider } from '../../overlays/portalHost';
import { lineContrast } from '../../testing/paintedContrast';
import { ContextMenuHost } from './ContextMenuHost';

afterEach(cleanup);

const act1 = (id: string) => ({
  id, label: id[0]!.toUpperCase() + id.slice(1), invoker: { timing: 'immediate' as const, run: () => {} },
});
const MENUS: MenuDef[] = [{
  id: 'm',
  menu: pref.group('', {
    edit: pref.group('', { cut: pref.action('cut'), copy: pref.action('copy') }),
    arr: pref.group('Arrange', { forward: pref.action('forward') }, { as: 'menu' }),
  }),
}];

let host: MenuHost | null = null;
function Setup() {
  useAction(act1('cut')); useAction(act1('copy')); useAction(act1('forward'));
  useMenus(MENUS);
  host = useMenuHost();
  return <ContextMenuHost />;
}

const W = 800;
const H = 600;
const inside = (r: DOMRect) => r.left >= 0 && r.top >= 0 && r.right <= W && r.bottom <= H;

it('keeps the menu and its submenu on screen when opened in the bottom-right corner', async () => {
  await page.viewport(W, H);
  render(<ActionsProvider><Setup /></ActionsProvider>);
  act(() => { host!.open({ menu: 'm', client: { x: W - 10, y: H - 10 }, source: 'pointer' }); });
  const root = screen.getByRole('menu');
  expect(inside(root.getBoundingClientRect())).toBe(true);

  fireEvent.keyDown(root, { key: 'ArrowDown' });
  fireEvent.keyDown(root, { key: 'ArrowUp' });
  expect(root.getAttribute('aria-activedescendant')).toBe(screen.getByRole('menuitem', { name: 'Arrange' }).id);
  fireEvent.keyDown(root, { key: 'ArrowRight' });

  const [parent, sub] = screen.getAllByRole('menu');
  expect(sub).toBeTruthy();
  const s = sub!.getBoundingClientRect();
  expect(inside(s)).toBe(true);
  // Placed against the row, so it overlaps the parent's padding rather than clearing its edge.
  expect(s.left).toBeLessThan(parent!.getBoundingClientRect().left);
});

const MUTED: MenuDef[] = [{ id: 'muted', menu: pref.group('', { cut: pref.action('cut'), off: pref.action('off') }) }];
function MutedSetup() {
  useAction(act1('cut'));
  useAction({ ...act1('off'), enabled: () => ActionDisabledReason.NotApplicable });
  useMenus(MUTED);
  host = useMenuHost();
  return <ContextMenuHost />;
}

for (const mode of ['light', 'dark']) {
  it(`draws enabled and disabled rows legibly whatever the page's text color, in ${mode} mode`, () => {
    document.documentElement.setAttribute('data-wzl-mode', mode);
    // The worst page color is the panel's own fill: the panel must not take its text color from the page.
    document.body.style.color = 'var(--wzl-surface-popover)';
    try {
      render(<ActionsProvider><MutedSetup /></ActionsProvider>);
      act(() => { host!.open({ menu: 'muted', client: { x: 20, y: 20 }, source: 'pointer' }); });
      const fill = getComputedStyle(screen.getByRole('menu')).backgroundColor;
      const on = screen.getByRole('menuitem', { name: 'Cut' });
      const off = screen.getByRole('menuitem', { name: 'Off' });
      expect(off.getAttribute('aria-disabled')).toBe('true');
      expect(lineContrast(getComputedStyle(on).color, fill)).toBeGreaterThan(4.5);
      expect(lineContrast(getComputedStyle(off).color, fill)).toBeGreaterThan(3);
    } finally {
      document.documentElement.removeAttribute('data-wzl-mode');
      document.body.style.color = '';
    }
  });
}

function ScaledSetup() {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setBox} className="wzl-menu-test-box">
      {box ? <OverlayPortalProvider container={box}><Setup /></OverlayPortalProvider> : null}
    </div>
  );
}

it('opens the menu at the pointer inside a box drawn at twice its size', async () => {
  await page.viewport(W, H);
  host = null;
  render(<ActionsProvider><ScaledSetup /></ActionsProvider>);
  await expect.poll(() => host).not.toBeNull();
  act(() => { host!.open({ menu: 'm', client: { x: 160, y: 110 }, source: 'pointer' }); });
  const menu = screen.getByRole('menu');
  expect(menu.closest('.wzl-menu-test-box')).not.toBeNull();
  const root = menu.getBoundingClientRect();
  expect(root.left).toBeCloseTo(160, 0);
  expect(root.top).toBeCloseTo(110, 0);
});
