import '@weasel-js/theme/tokens.css';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Button as RACButton, Dialog as RACDialog, DialogTrigger } from 'react-aria-components';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { pref } from '@weasel-js/prefs';
import { ActionsProvider, useAction, useMenuHost, useMenus, type MenuDef, type MenuHost } from '@weasel-js/core';
import { ContextMenuHost } from '@weasel-js/ui/components/Menu';
import { Dialog } from '@weasel-js/ui/components/Dialog';
import { Popover } from '@weasel-js/ui/components/Popover';
import { createToastQueue, ToastRegion } from '@weasel-js/ui/components/Toast';
import { Tooltip, TooltipTrigger } from '@weasel-js/ui/components/Tooltip';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';

// Which theme an overlay resolves is a cascade question jsdom cannot answer: it resolves no `var()`.

const probeStyle = document.createElement('style');
probeStyle.textContent = '.theme-probe { display: block; width: 4px; height: 4px; background-color: var(--wzl-surface); }';
document.head.append(probeStyle);

beforeEach(() => {
  // The page is dark; the app root each overlay opens from is light.
  document.documentElement.setAttribute('data-wzl-mode', 'dark');
  // With view transitions on, a toast reaches the DOM only on a later frame.
  const real = window.matchMedia.bind(window);
  vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
    query.includes('prefers-reduced-motion') ? ({ ...real(query), matches: true } as MediaQueryList) : real(query),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-wzl-mode');
});

/** The surface color an element appended to `el` paints. */
function surfaceIn(el: Element): string {
  const probe = document.createElement('i');
  probe.className = 'theme-probe';
  el.append(probe);
  const color = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return color;
}

function inLightRoot(overlay: ReactNode) {
  return renderWithIcons(
    <div data-wzl-mode="light" data-testid="light-root">
      {overlay}
    </div>,
  );
}

function expectLight(overlay: Element) {
  const light = surfaceIn(screen.getByTestId('light-root'));
  const dark = surfaceIn(document.body);
  expect(light).not.toBe(dark);
  expect(surfaceIn(overlay)).toBe(light);
}

it('draws a bare Popover in the theme of the root it opens from', async () => {
  inLightRoot(
    <DialogTrigger defaultOpen>
      <RACButton>Open</RACButton>
      <Popover data-testid="popover">
        <RACDialog aria-label="Picker">Item</RACDialog>
      </Popover>
    </DialogTrigger>,
  );
  expectLight(await screen.findByTestId('popover'));
});

it('draws a Tooltip in the theme of the root it opens from', async () => {
  inLightRoot(
    <TooltipTrigger defaultOpen>
      <RACButton>Hover</RACButton>
      <Tooltip>Tip</Tooltip>
    </TooltipTrigger>,
  );
  expectLight(await screen.findByRole('tooltip'));
});

it('draws a toast in the theme of the root its region is mounted in', async () => {
  const queue = createToastQueue();
  inLightRoot(<ToastRegion queue={queue} />);
  act(() => queue.add('info', 'Saved', { ttlMs: null }));
  expectLight(await screen.findByRole('alertdialog'));
});

it('draws a Dialog in the theme of the root it opens from', async () => {
  inLightRoot(<Dialog isOpen title="Settings">Body</Dialog>);
  expectLight(await screen.findByRole('dialog'));
});

const MENUS: MenuDef[] = [{ id: 'm', menu: pref.group('', { cut: pref.action('cut') }) }];
let host: MenuHost | null = null;
function MenuSetup() {
  useAction({ id: 'cut', label: 'Cut', invoker: { timing: 'immediate' as const, run: () => {} } });
  useMenus(MENUS);
  host = useMenuHost();
  return <ContextMenuHost />;
}

it('draws a context menu in the theme of the root it opens from', async () => {
  render(
    <div data-wzl-mode="light" data-testid="light-root">
      <ActionsProvider>
        <MenuSetup />
      </ActionsProvider>
    </div>,
  );
  act(() => { host!.open({ menu: 'm', client: { x: 20, y: 20 }, source: 'pointer' }); });
  expectLight(await screen.findByRole('menu'));
});
