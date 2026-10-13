import { describe, it, expect, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { Action } from '../actions/action';
import type { Tool } from '../../tools/types';
import type { InputEvent } from './matcher';
import {
  makeRegistry,
  makeCtx,
  immediateAction,
  ongoingAction,
} from './testing/dispatcherStubs';

// ---------------------------------------------------------------------------
// describe createDispatcher
// ---------------------------------------------------------------------------

describe('createDispatcher', () => {

  describe('resolveOnly', () => {
    const dragQuery: InputEvent = {
      kind: 'pointerdown',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      bodyTarget: 'empty',
    };

    it('predicts the winning action without invoking it', () => {
      const startFn = vi.fn().mockReturnValue({ onMove: vi.fn(), onEnd: vi.fn() });
      const action: Action = {
        ...ongoingAction('viewport.dragPan', { kind: 'drag' }, startFn),
        cursor: 'grab',
      };
      const registry = makeRegistry([action]);
      const dispatcher = createDispatcher();

      const result = dispatcher.resolveOnly(dragQuery, makeCtx({ actions: registry }));
      expect(result?.actionId).toBe('viewport.dragPan');
      expect(result?.action.cursor).toBe('grab');
      expect(result?.scope).toBe('ambient');
      expect(startFn).not.toHaveBeenCalled();
      expect(dispatcher.inFlight().size).toBe(0);
    });

    it('returns null when no binding matches', () => {
      const registry = makeRegistry([immediateAction('actionA', 'a')]);
      const dispatcher = createDispatcher();
      expect(dispatcher.resolveOnly(dragQuery, makeCtx({ actions: registry }))).toBeNull();
    });

    it('falls through a disabled candidate to the next-best match', () => {
      // Specific (targeted) binding is disabled; the generic pan wins —
      // mirrors "marquee deps not wired → drag pans instead".
      const marquee: Action = {
        ...ongoingAction('areaSelect', { kind: 'drag', target: 'empty' }, vi.fn()),
        enabled: () => 'not-applicable' as const,
      };
      const pan: Action = {
        ...ongoingAction('viewport.dragPan', { kind: 'drag' }, vi.fn()),
        cursor: 'grab',
      };
      const registry = makeRegistry([marquee, pan]);
      const dispatcher = createDispatcher();

      const result = dispatcher.resolveOnly(dragQuery, makeCtx({ actions: registry }));
      expect(result?.actionId).toBe('viewport.dragPan');
    });

    it('prefers the more specific candidate when both are enabled', () => {
      const marquee = ongoingAction('areaSelect', { kind: 'drag', target: 'empty' }, vi.fn());
      const pan: Action = {
        ...ongoingAction('viewport.dragPan', { kind: 'drag' }, vi.fn()),
        cursor: 'grab',
      };
      const registry = makeRegistry([marquee, pan]);
      const dispatcher = createDispatcher();

      const result = dispatcher.resolveOnly(dragQuery, makeCtx({ actions: registry }));
      expect(result?.actionId).toBe('areaSelect');
    });

    it('respects the eligibility filter when getRuleCtx is supplied', () => {
      const action: Action = {
        ...ongoingAction('only-path-edit', { kind: 'drag' }, vi.fn()),
        eligible: { mode: 'path-edit' },
      };
      const registry = makeRegistry([action]);
      const dispatcher = createDispatcher();

      const ruleCtx = {
        focused: true,
        selection: [],
        multiActive: false,
        modifiers: { alt: false, ctrl: false, meta: false, shift: false },
        action: { kind: null, id: null },
        hover: null,
        view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
        mode: 'normal',
        allowedCapabilities: new Set<string>(),
      };
      const result = dispatcher.resolveOnly(
        dragQuery,
        makeCtx({ actions: registry, getRuleCtx: () => ruleCtx }),
      );
      expect(result).toBeNull();
    });

    it('reports the owning tool for active-scope bindings', () => {
      const toolAction: Action = {
        ...ongoingAction('hand.pan', { kind: 'drag' }, vi.fn()),
        cursor: 'grab',
      };
      // Strip defaultBinding — the binding comes from the tool, not ambient.
      delete (toolAction as { defaultBinding?: unknown }).defaultBinding;
      const registry = makeRegistry([toolAction]);
      const activeTool: Tool = {
        id: 'hand',
        eligibility: { focus: true },
        bindings: [{ spec: { kind: 'drag' }, actionId: 'hand.pan' }],
      };
      const dispatcher = createDispatcher();

      const result = dispatcher.resolveOnly(
        dragQuery,
        makeCtx({
          actions: registry,
          activeToolId: 'hand',
          entriesById: new Map([['hand', activeTool]]),
        }),
      );
      expect(result?.actionId).toBe('hand.pan');
      expect(result?.scope).toBe('active');
      expect(result?.ownerId).toBe('hand');
    });
  });
});
