// src/tools/useKeybindings.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { useTools } from './useTools';
import { useKeybindings } from './useKeybindings';
import { defineTool } from './routing/defineTool';
import { ActiveToolContextProvider, useActiveToolContext } from '../interactions/actions/activeToolContext';
import { ActionsProvider } from '../interactions/actions/registry';
import { useActionsRegistry } from '../interactions/actions/registry';
import { DepRegistryProvider, useDepSource } from '../interactions/actions/depRegistry';
import { useGestureDispatcher } from '../interactions/dispatcher/useGestureDispatcher';
import { useRef } from 'react';

function press(key: string, type: 'keydown' | 'keyup' = 'keydown'): void {
  document.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
}

/**
 * Pumps window key events into the dispatcher and publishes the `activeTool`
 * dep, which is what `tool.activate` / `tool.resetToDefault` need to run.
 *
 * Tool activation used to work in this file without any of this, because
 * `useKeybindings` also attached its own document `keydown` listener that
 * called `ToolsApi.setActive` directly. That second listener is gone (audit
 * 3.8) — activation is the `tool.activate` Action and nothing else — so a
 * harness that wants to assert activation BEHAVIOR has to mount the
 * dispatcher. Tests that only assert registration don't need it.
 */
function KeyDispatchHarness() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const actions = useActionsRegistry();
  const ctx = useActiveToolContext();
  useDepSource('activeTool', () => ctx);
  useGestureDispatcher({
    canvasRef,
    actions: actions!,
    toolsById: new Map(),
  });
  return null;
}

function makeWrapper(initialActive = 'select', dispatch = false) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      DepRegistryProvider,
      null,
      createElement(
        ActionsProvider,
        null,
        createElement(ActiveToolContextProvider, {
          initialActive,
          children: dispatch
            ? [children, createElement(KeyDispatchHarness, { key: 'dispatch' })]
            : children,
        }),
      ),
    );
  };
}

describe('useKeybindings', () => {
  it('switches active tool on ToolDef keybinding press', () => {
    const select = defineTool({ id: 'select', keybinding: { key: 'v' } });
    const pen    = defineTool({ id: 'pen',    keybinding: { key: 'p' } });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, pen } });
      useKeybindings(tools);
      return tools;
    }, { wrapper: makeWrapper('select', true) });

    expect(result.current.active).toBe('select');
    act(() => press('p'));
    expect(result.current.active).toBe('pen');
    act(() => press('v'));
    expect(result.current.active).toBe('select');
  });

  it('registers a single tool.activate action with one binding entry per built-in tool in BUILTIN_SELECT_KEYS', () => {
    const select = defineTool({ id: 'select' });
    const pen    = defineTool({ id: 'pen' });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, pen } });
      useKeybindings(tools);
      return useActionsRegistry();
    }, { wrapper: makeWrapper('select') });

    const ids = result.current?.list().map((a) => a.id) ?? [];
    expect(ids).toContain('tool.activate');
    // No per-tool activate/shortcut actions any more.
    expect(ids).not.toContain('tool.activate.select');
    expect(ids).not.toContain('tool.shortcut.select');

    const activate = result.current?.list().find((a) => a.id === 'tool.activate');
    const bindings = (activate?.defaultBinding ?? []) as unknown as Array<{ opts: { params: { toolId: string } } }>;
    const toolIds = bindings.map((b) => b.opts.params.toolId);
    expect(toolIds).toContain('select');
    expect(toolIds).toContain('pen');
  });

  it('appends an entry for each ToolDef.keybinding to tool.activate.defaultBinding', () => {
    const select = defineTool({ id: 'select' });
    const lasso  = defineTool({ id: 'lasso',  keybinding: { key: 'L' } });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, lasso } });
      useKeybindings(tools);
      return useActionsRegistry();
    }, { wrapper: makeWrapper('select') });

    const activate = result.current?.list().find((a) => a.id === 'tool.activate');
    expect(activate).toBeDefined();
    const bindings = (activate?.defaultBinding ?? []) as unknown as Array<{
      spec: { kind: string; key: string };
      opts: { params: { toolId: string } };
    }>;
    const lassoEntry = bindings.find((b) => b.opts.params.toolId === 'lasso');
    expect(lassoEntry).toBeDefined();
    expect(lassoEntry?.spec).toMatchObject({ kind: 'key', key: 'L' });
  });

  it('registers a single tool.offhand action with one key-held entry per built-in offhand tool', () => {
    const select = defineTool({ id: 'select' });
    const hand   = defineTool({ id: 'hand' });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, hand } });
      useKeybindings(tools);
      return useActionsRegistry();
    }, { wrapper: makeWrapper('select') });

    const ids = result.current?.list().map((a) => a.id) ?? [];
    expect(ids).toContain('tool.offhand');

    const offhand = result.current?.list().find((a) => a.id === 'tool.offhand');
    const bindings = (offhand?.defaultBinding ?? []) as unknown as Array<{
      spec: { kind: string; key: string };
      opts: { params: { toolId: string } };
    }>;
    const handEntry = bindings.find((b) => b.opts.params.toolId === 'hand');
    expect(handEntry).toBeDefined();
    expect(handEntry?.spec).toMatchObject({ kind: 'key-held', key: ' ' });
    // No entry for select (not in BUILTIN_OFFHAND_ACTIONS).
    expect(bindings.find((b) => b.opts.params.toolId === 'select')).toBeUndefined();
  });

  it('does not register tool.offhand when no offhand-eligible tool is in the registry', () => {
    const select = defineTool({ id: 'select' });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select } });
      useKeybindings(tools);
      return useActionsRegistry();
    }, { wrapper: makeWrapper('select') });

    const ids = result.current?.list().map((a) => a.id) ?? [];
    expect(ids).not.toContain('tool.offhand');
  });

  it('lets meta/ctrl combos through (system shortcuts like Cmd-R reload)', () => {
    const select = defineTool({ id: 'select', keybinding: { key: 'v' } });
    const insert = defineTool({ id: 'insert', keybinding: { key: 'r' } });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, insert } });
      useKeybindings(tools);
      return tools;
    }, { wrapper: makeWrapper('select', true) });

    // Cmd-R must NOT switch tools (browser reload).
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', metaKey: true, bubbles: true }));
    });
    expect(result.current.active).toBe('select');

    // Ctrl-R likewise.
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, bubbles: true }));
    });
    expect(result.current.active).toBe('select');

    // Bare R still switches.
    act(() => press('r'));
    expect(result.current.active).toBe('insert');
  });

  it('supports mod-aware bindings (Cmd/Ctrl+D)', () => {
    // `mod` is now resolved by the dispatcher's matcher, which is
    // PLATFORM-AWARE: meta on mac, ctrl elsewhere, with the other platform's
    // key forbidden. The deleted document listener used the looser
    // `matchesKeyBinding`, where `mod` meant "meta OR ctrl" on every
    // platform — so Cmd+D fired on Windows too. jsdom reports non-mac, so
    // the modifier under test here is Ctrl.
    const IS_MAC = /mac/i.test(
      (navigator as { platform?: string }).platform ?? navigator.userAgent,
    );
    const select  = defineTool({ id: 'select', keybinding: { key: 'v' } });
    const stylize = defineTool({ id: 'stylize', keybinding: { key: 'd', mod: true } });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, stylize } });
      useKeybindings(tools);
      return tools;
    }, { wrapper: makeWrapper('select', true) });

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'd', bubbles: true,
        ...(IS_MAC ? { metaKey: true } : { ctrlKey: true }),
      }));
    });
    expect(result.current.active).toBe('stylize');

    // The other platform's modifier must NOT fire it.
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'd', bubbles: true,
        ...(IS_MAC ? { ctrlKey: true } : { metaKey: true }),
      }));
    });
    expect(result.current.active).toBe('select');
  });

  it('disable: true skips all wiring', () => {
    const select = defineTool({ id: 'select', keybinding: { key: 'v' } });
    const pen    = defineTool({ id: 'pen',    keybinding: { key: 'p' } });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, pen } });
      useKeybindings(tools, { disable: true });
      return tools;
    }, { wrapper: makeWrapper('select', true) });

    act(() => press('p'));
    expect(result.current.active).toBe('select');
  });

  it('disable: true also skips tool.offhand registration', () => {
    const select = defineTool({ id: 'select' });
    const hand   = defineTool({ id: 'hand' });
    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, hand } });
      useKeybindings(tools, { disable: true });
      const reg = useActionsRegistry();
      return reg?.list() ?? [];
    }, { wrapper: makeWrapper('select') });

    const ids = result.current.map((a) => a.id);
    expect(ids).not.toContain('tool.offhand');
    expect(ids).not.toContain('tool.activate');
  });

  it('skips when focus is in an editable element', () => {
    const select = defineTool({ id: 'select', keybinding: { key: 'v' } });
    const pen    = defineTool({ id: 'pen',    keybinding: { key: 'p' } });
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const { result } = renderHook(() => {
      const tools = useTools({ active: 'select', registry: { select, pen } });
      useKeybindings(tools);
      return tools;
    }, { wrapper: makeWrapper('select', true) });

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }));
    });
    expect(result.current.active).toBe('select');

    document.body.removeChild(input);
  });

  describe('Escape returns to default tool', () => {
    it('Escape switches active tool back to the initial active by default', () => {
      const select = defineTool({ id: 'select' });
      const pen    = defineTool({ id: 'pen', keybinding: { key: 'p' } });
      const { result } = renderHook(() => {
        const tools = useTools({ active: 'select', registry: { select, pen } });
        useKeybindings(tools);
        return tools;
      }, { wrapper: makeWrapper('select', true) });

      act(() => press('p'));
      expect(result.current.active).toBe('pen');
      act(() => press('Escape'));
      expect(result.current.active).toBe('select');
    });

    it('explicit defaultTool wins over the snapshotted initial', () => {
      const select = defineTool({ id: 'select' });
      const pen    = defineTool({ id: 'pen', keybinding: { key: 'p' } });
      const hand   = defineTool({ id: 'hand', keybinding: { key: 'h' } });
      const { result } = renderHook(() => {
        const tools = useTools({ active: 'select', registry: { select, pen, hand } });
        useKeybindings(tools, { defaultTool: 'hand' });
        return tools;
      }, { wrapper: makeWrapper('select', true) });

      act(() => press('p'));
      expect(result.current.active).toBe('pen');
      act(() => press('Escape'));
      expect(result.current.active).toBe('hand');
    });

    it('defaultTool: null disables the Escape behavior', () => {
      const select = defineTool({ id: 'select' });
      const pen    = defineTool({ id: 'pen', keybinding: { key: 'p' } });
      const { result } = renderHook(() => {
        const tools = useTools({ active: 'select', registry: { select, pen } });
        useKeybindings(tools, { defaultTool: null });
        return tools;
      }, { wrapper: makeWrapper('select', true) });

      act(() => press('p'));
      expect(result.current.active).toBe('pen');
      act(() => press('Escape'));
      expect(result.current.active).toBe('pen');
    });
  });

  describe('isToolEligible gate', () => {
    // `Tool.capabilities` used to describe an intent the runtime never
    // enforced: `ToolPalette` greyed an ineligible tool's button while its
    // keyboard shortcut still activated it, and once active its routes ran
    // unfiltered (audit 3.10). Activation now consults the same predicate.
    function setup(isToolEligible?: (id: string) => boolean) {
      const select = defineTool({ id: 'select', keybinding: { key: 'v' } });
      const pen    = defineTool({ id: 'pen',    keybinding: { key: 'p' } });
      return renderHook(() => {
        const tools = useTools({ active: 'select', registry: { select, pen } });
        useKeybindings(tools, isToolEligible ? { isToolEligible } : {});
        return tools;
      }, { wrapper: makeWrapper('select', true) });
    }

    it('refuses activation when the tool is ineligible', () => {
      const { result } = setup((id) => id !== 'pen');
      act(() => press('p'));
      expect(result.current.active).toBe('select');
    });

    it('allows activation when the tool is eligible', () => {
      const { result } = setup((id) => id === 'pen');
      act(() => press('p'));
      expect(result.current.active).toBe('pen');
    });

    it('every tool stays activatable when no gate is supplied', () => {
      const { result } = setup();
      act(() => press('p'));
      expect(result.current.active).toBe('pen');
    });
  });
});
