/**
 * The command bar's own buttons (grid, snap, release compound path, the
 * command palette) are registered actions: the key a button's tooltip names is
 * the binding that fires it.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { ActionsProvider, DepRegistryProvider, SceneCanvas, createScene } from '@weasel-js/core';
import { ActionBar } from '@weasel-js/ui/components/ActionBar';
import { appCommandsContribution, type AppCommands } from './index';
import { withIcons } from '../testIcons';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
});
afterEach(() => cleanup());

function setup(over: Partial<AppCommands> = {}) {
  const commands: AppCommands = {
    gridVisible: false,
    toggleGrid: vi.fn(),
    snapToGrid: false,
    toggleSnap: vi.fn(),
    symmetryOn: false,
    toggleSymmetry: vi.fn(),
    canReleaseCompound: true,
    releaseCompound: vi.fn(),
    openPalette: vi.fn(),
    chromeHidden: () => false,
    toggleChrome: vi.fn(),
    ...over,
  };
  const scene = createScene<{ kind: 'rect' }, 'main', { x: number; y: number; width: number; height: number }>(
    { systemLayers: [{ id: 'main' }] },
  );
  render(
    <DepRegistryProvider>
      <ActionsProvider>
        <ActionBar group="view" />
        <ActionBar group="compound" />
        <ActionBar group="app" />
        <SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64}
          ambient={[appCommandsContribution(() => commands)]} />
      </ActionsProvider>
    </DepRegistryProvider>,
    { wrapper: withIcons },
  );
  const key = (init: KeyboardEventInit) => act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
  });
  return { commands, key };
}

describe('draw app commands', () => {
  it('Shift+3 toggles the grid', () => {
    const t = setup();
    t.key({ key: '#', code: 'Digit3', shiftKey: true });
    expect(t.commands.toggleGrid).toHaveBeenCalledOnce();
  });

  it('Shift+| releases a compound path, and does nothing when there is none', () => {
    const t = setup();
    t.key({ key: '|', code: 'Backslash', shiftKey: true });
    expect(t.commands.releaseCompound).toHaveBeenCalledOnce();
    cleanup();
    const none = setup({ canReleaseCompound: false });
    none.key({ key: '|', code: 'Backslash', shiftKey: true });
    expect(none.commands.releaseCompound).not.toHaveBeenCalled();
  });

  it('mod+K opens the command palette', () => {
    const t = setup();
    t.key({ key: 'k', code: 'KeyK', ctrlKey: true });
    expect(t.commands.openPalette).toHaveBeenCalledOnce();
  });

  it('draws grid and snap as toggles that show their state, and fires on click', () => {
    const t = setup({ gridVisible: true });
    const grid = screen.getByRole('button', { name: 'Show grid' });
    const snap = screen.getByRole('button', { name: 'Snap to grid' });
    expect(grid.getAttribute('aria-pressed')).toBe('true');
    expect(snap.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(snap);
    expect(t.commands.toggleSnap).toHaveBeenCalledOnce();
    expect(t.commands.toggleGrid).not.toHaveBeenCalled();
  });

  it('draws symmetry as a toggle that shows its state, and fires on click', () => {
    const t = setup({ symmetryOn: true });
    const symmetry = screen.getByRole('button', { name: 'Symmetry' });
    expect(symmetry.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(symmetry);
    expect(t.commands.toggleSymmetry).toHaveBeenCalledOnce();
  });

  it('disables Release compound path when no selected path is compound', () => {
    setup({ canReleaseCompound: false });
    const release = screen.getByRole('button', { name: 'Release compound path' }) as HTMLButtonElement;
    expect(release.disabled || release.getAttribute('aria-disabled') === 'true').toBe(true);
  });

  it('offers the command palette as a button', () => {
    const t = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Commands' }));
    expect(t.commands.openPalette).toHaveBeenCalledOnce();
  });
});
