import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { type ActionsRegistry, createScene, SceneCanvas, useActionsRegistry, useCommand } from '@weasel-js/core';
import { pref } from '@weasel-js/prefs';
import { createMemoryAdapter } from '@weasel-js/storage';
import { renderWithIcons as render } from '@weasel-js/ui/testing/withIcons';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { EDITOR_ACTIONS } from './editorCommands';
import { EditorShell } from './EditorShell';
import { menuRun } from './menuBar';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
});
afterEach(() => cleanup());

const PREFS = pref.group('Test preferences', {
  view: pref.group('View', { grid: pref.boolean('Show grid', false) }),
});
const prefs = () => ({ schema: PREFS, storage: createMemoryAdapter(new Map()), prefix: 'test.prefs/' });

// jsdom is not an Apple platform, so mod is Ctrl.
const key = (init: KeyboardEventInit) => act(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
});
const modComma = () => key({ key: ',', code: 'Comma', ctrlKey: true });

let registry: ActionsRegistry | null = null;
function Probe({ run }: { run?: () => void }) {
  registry = useActionsRegistry();
  useCommand('test.q', 'Q', () => run?.(), { keys: { kind: 'key', key: 'q' } });
  return null;
}

const scene = () => createScene<{ kind: 'rect' }, 'main', { x: number; y: number; width: number; height: number }>(
  { systemLayers: [{ id: 'main' }] },
);

describe('EditorShell', () => {
  it('opens the preferences dialog from its command', () => {
    render(<EditorShell prefs={prefs()}><Probe /></EditorShell>);
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => { registry?.trigger(EDITOR_ACTIONS.preferences); });
    expect(screen.getByRole('dialog', { name: 'Test preferences' })).toBeTruthy();
  });

  it('binds Mod+, to Preferences…, with no canvas mounted', () => {
    render(<EditorShell prefs={prefs()}><Probe /></EditorShell>);
    const action = registry?.list().find((a) => a.id === EDITOR_ACTIONS.preferences);
    expect(action?.label).toBe('Preferences…');
    modComma();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('takes its key, label, and group from `preferences`, and registers nothing for `null`', () => {
    const { unmount } = render(
      <EditorShell prefs={prefs()} preferences={{ label: 'Settings', keys: null, group: 'app' }}><Probe /></EditorShell>,
    );
    const action = registry?.list().find((a) => a.id === EDITOR_ACTIONS.preferences);
    expect(action).toMatchObject({ label: 'Settings', group: 'app' });
    expect(action?.defaultBinding).toBeUndefined();
    unmount();
    render(<EditorShell prefs={prefs()} preferences={null}><Probe /></EditorShell>);
    expect(registry?.list().some((a) => a.id === EDITOR_ACTIONS.preferences)).toBe(false);
  });

  it("runs an app command's key with no canvas mounted", () => {
    const run = vi.fn();
    render(<EditorShell><Probe run={run} /></EditorShell>);
    key({ key: 'q' });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs a command key once while a canvas holds the keys', () => {
    const run = vi.fn();
    render(
      <EditorShell>
        <Probe run={run} />
        <SceneCanvas features={['draw']} scene={scene()} layers={{}} width={64} height={64} claimKeys />
      </EditorShell>,
    );
    key({ key: 'q' });
    expect(run).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(document.querySelector('canvas')!, { button: 1, pointerId: 1 });
    fireEvent.pointerUp(document.querySelector('canvas')!, { button: 1, pointerId: 1 });
    key({ key: 'q' });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('draws the menu bar from contributions, in title order, and redraws it for new ones', () => {
    const file = { open: menuRun({ q: 'test.q' }) };
    const { rerender } = render(<EditorShell menus={{ file }}><Probe /></EditorShell>);
    const titles = () => within(screen.getByRole('menubar')).getAllByRole('menuitem').map((t) => t.textContent);
    expect(titles()).toEqual(['File', 'Edit']);
    rerender(<EditorShell menus={{ view: { prefs: menuRun({ p: EDITOR_ACTIONS.preferences }) }, file }}><Probe /></EditorShell>);
    expect(titles()).toEqual(['File', 'Edit', 'View']);
  });

  it('hands an inline menu bar to the topbar, and draws a row one above it', () => {
    const menus = { file: {} };
    const topbar = (bar: unknown) => <div data-testid="topbar">{bar as never}</div>;
    const { unmount } = render(<EditorShell menus={menus} menuBar="inline" topbar={topbar} />);
    expect(within(screen.getByTestId('topbar')).getByRole('menubar')).toBeTruthy();
    unmount();
    render(<EditorShell menus={menus} topbar={topbar} />);
    expect(within(screen.getByTestId('topbar')).queryByRole('menubar')).toBeNull();
    expect(screen.getByRole('menubar')).toBeTruthy();
  });
});
