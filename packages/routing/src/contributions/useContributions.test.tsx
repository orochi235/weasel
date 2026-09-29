/**
 * Assembly reads declared eligibility, so an entry lands in a scope tier
 * because of what it says about itself — not because of which argument the
 * consumer passed it in.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useContributions } from './useContributions';
import type { Contribution } from './types';
import {
  ActiveToolContextProvider,
  useActiveToolContext,
  type ActiveToolContextValue,
} from '../interactions/actions/activeToolContext';
import { DepRegistryProvider, useDepSource } from '../interactions/actions/depRegistry';
import { useGestureDispatcher } from '../interactions/dispatcher/useGestureDispatcher';
import { ActionsProvider, useAction, useActionsRegistry } from '../interactions/actions/ActionsProvider';
import type { Action } from '../interactions/actions/action';
import { renderThenAbandon } from '../testing/abandonRender';

const rect: Contribution = {
  id: 'rect',
  eligibility: { focus: true },
  bindings: [{ spec: { kind: 'drag' }, actionId: 'insert' }],
};
const hud: Contribution = {
  id: 'weasel-hud',
  eligibility: { claimed: true },
  bindings: [{ spec: { kind: 'drag', target: { kindOf: () => true } }, actionId: 'hud.drag' }],
};

function wrapper({ children }: { children: ReactNode }) {
  return <ActiveToolContextProvider>{children}</ActiveToolContextProvider>;
}

describe('useContributions', () => {
  it('scopes a focused entry active and a claimed entry ambient', () => {
    const { result } = renderHook(
      () => useContributions({ entries: [rect, hud], focused: 'rect' }),
      { wrapper },
    );
    const scoped = result.current.scopedBindings();
    expect(scoped.find((s) => s.ownerId === 'rect')?.scope).toBe('active');
    expect(scoped.find((s) => s.ownerId === 'weasel-hud')?.scope).toBe('ambient');
  });

  it('omits an unfocused focus-only entry entirely', () => {
    const { result } = renderHook(
      () => useContributions({ entries: [rect, hud], focused: 'other' }),
      { wrapper },
    );
    expect(result.current.scopedBindings().some((s) => s.ownerId === 'rect')).toBe(false);
  });
});

// `entries` was once captured inside a memo keyed only on the focused tool, so
// a consumer adding a tool without switching tools saw a live, hittable
// binding with no palette entry and no chrome — the "visible implies hittable"
// invariant inverted.
describe('ContributionsApi.entries tracks the entry list', () => {
  const pen: Contribution = {
    id: 'pen',
    eligibility: { always: true },
    bindings: [{ spec: { kind: 'drag' }, actionId: 'pen.draw' }],
  };

  it('shows an entry added with no change of focused tool', () => {
    const { result, rerender } = renderHook(
      ({ entries }: { entries: Contribution[] }) => useContributions({ entries, focused: 'rect' }),
      { wrapper, initialProps: { entries: [rect, hud] } },
    );
    expect(result.current.entries.map((e) => e.id)).toEqual(['rect', 'weasel-hud']);
    rerender({ entries: [rect, hud, pen] });
    expect(result.current.scopedBindings().some((s) => s.ownerId === 'pen')).toBe(true);
    expect(result.current.entries.map((e) => e.id)).toEqual(['rect', 'weasel-hud', 'pen']);
  });

  it('keeps one API identity while a rebuilt list holds the same entries', () => {
    const { result, rerender } = renderHook(
      ({ entries }: { entries: Contribution[] }) => useContributions({ entries, focused: 'rect' }),
      { wrapper, initialProps: { entries: [rect, hud] } },
    );
    const before = result.current;
    rerender({ entries: [rect, hud] });
    expect(result.current).toBe(before);
  });

  // Read while rendering — `<Canvas>` composes its layer list from
  // `overlays()` in a memo — so each render's API has to answer with that
  // render's entries, and an abandoned render's must not linger.
  it('answers a render-time read with that render\'s entries, and drops an abandoned render\'s', () => {
    const overlayOf = (id: string): Contribution => ({ id, eligibility: { always: true }, overlay: { id } as never });
    const a = overlayOf('a');
    const b = overlayOf('b');
    const seen: string[][] = [];
    let api!: ReturnType<typeof useContributions>;
    function Probe({ entries }: { entries: Contribution[] }): null {
      const rendered = useContributions({ entries, focused: null });
      seen.push(rendered.overlays().map((o) => (o as { id: string }).id));
      useLayoutEffect(() => { api = rendered; });
      return null;
    }
    renderThenAbandon([a], [a, b], (entries) => (
      <ActiveToolContextProvider><Probe entries={entries} /></ActiveToolContextProvider>
    ));
    expect(seen).toContainEqual(['a', 'b']);
    expect(api.overlays().map((o) => (o as { id: string }).id)).toEqual(['a']);
    expect(api.entries.map((e) => e.id)).toEqual(['a']);
  });
});

describe('route-conflict reporting sees action default bindings', () => {
  const collidingSpec = { kind: 'click', target: 'empty' } as const;

  const ambientEntry: Contribution = {
    id: 'ambient-entry',
    eligibility: { always: true },
    bindings: [{ spec: collidingSpec, actionId: 'entry.click' }],
  };

  const collidingAction: Action = {
    id: 'colliding.action',
    kind: 'immediate',
    deps: [],
    defaultBinding: collidingSpec,
    run: () => {},
  } as unknown as Action;

  function actionsWrapper({ children }: { children: ReactNode }) {
    return (
      <ActionsProvider>
        <ActiveToolContextProvider>{children}</ActiveToolContextProvider>
      </ActionsProvider>
    );
  }

  it('reports an entry binding that collides with an action default binding', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderHook(
      () => {
        useAction(collidingAction);
        return useContributions({ entries: [ambientEntry], focused: 'select' });
      },
      { wrapper: actionsWrapper },
    );
    const messages = warn.mock.calls.map((args) => String(args[0]));
    const conflict = messages.find((m) => m.includes('route conflict'));
    warn.mockRestore();
    expect(conflict).toBeDefined();
    expect(conflict).toContain('ambient-entry');
    expect(conflict).toContain('colliding.action');
  });
});

// Every tool `defineTool` builds declares `focus: true`, and `useTools`'
// `declareSlot(tool, 'always')` adds `always: true` on top of it. Bucketing on
// "not focus-eligible" therefore put every ambient tool in the registry
// bucket, which `findScopedConflicts` never compares against itself — so the
// whole ambient-vs-ambient collision class was reported by nothing.
describe('conflict buckets follow declared eligibility', () => {
  const drag = (id: string) => ({
    id,
    eligibility: { focus: true, always: true },
    bindings: [{ spec: { kind: 'drag' }, actionId: `${id}.drag` }],
  } as Contribution);

  it('reports two always-on entries that also declare focus', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderHook(
      () => useContributions({ entries: [drag('rotate'), drag('mySnap')], focused: 'rotate' }),
      { wrapper },
    );
    const said = warn.mock.calls.flat().join('\n');
    warn.mockRestore();
    expect(said).toContain('rotate');
    expect(said).toContain('mySnap');
  });
});

describe('a declared offhand trigger engages its entry', () => {
  const hand: Contribution = {
    id: 'hand',
    eligibility: { focus: true, offhand: 'space' },
    bindings: [{ spec: { kind: 'drag' }, actionId: 'viewport.dragPan' }],
  };

  function OffhandHarness({ children }: { children: ReactNode }) {
    return (
      <DepRegistryProvider>
        <ActiveToolContextProvider>
          <ActionsProvider>{children}</ActionsProvider>
        </ActiveToolContextProvider>
      </DepRegistryProvider>
    );
  }

  function ActiveToolDepSource() {
    const ctx = useActiveToolContext();
    useDepSource('activeTool', () => ctx);
    return null;
  }

  function Mount({ onCtx }: { onCtx: (v: ActiveToolContextValue) => void }) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const registry = useActionsRegistry();
    onCtx(useActiveToolContext());
    useContributions({ entries: [hand], focused: 'select' });
    useGestureDispatcher({ canvasRef, actions: registry!, entriesById: new Map() });
    return <canvas ref={canvasRef} />;
  }

  it('holds the entry at hotkey scope while its trigger is down, with no host wiring', () => {
    // Nothing here calls buildToolOffhandBindings or registers tool.offhand.
    let ctx!: ActiveToolContextValue;
    render(
      <OffhandHarness>
        <ActiveToolDepSource />
        <Mount onCtx={(v) => { ctx = v; }} />
      </OffhandHarness>,
    );
    expect(ctx.hotkeyStack).toEqual([]);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })); });
    expect(ctx.hotkeyStack).toEqual(['hand']);
    act(() => { window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' })); });
    expect(ctx.hotkeyStack).toEqual([]);
  });

  it('registers exactly one tool.offhand action', () => {
    // Two registrations of the same id is how space-for-hand engages twice.
    let registry: ReturnType<typeof useActionsRegistry> = null;
    function Capture() { registry = useActionsRegistry(); return null; }
    render(
      <OffhandHarness>
        <ActiveToolDepSource />
        <Mount onCtx={() => {}} />
        <Capture />
      </OffhandHarness>,
    );
    const offhands = (registry!.list()).filter((a) => a.id === 'tool.offhand');
    expect(offhands).toHaveLength(1);
    expect(offhands[0].defaultBinding).toEqual([
      { spec: { kind: 'key-held', key: ' ' }, opts: { params: { toolId: 'hand' } } },
    ]);
  });
});
