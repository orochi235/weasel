import { describe, it, expect, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { InputEvent } from './matcher';
import { makeRegistry, makeCtx, ongoingAction, keyAEvent } from './testing/dispatcherStubs';

// ---------------------------------------------------------------------------
// describe createDispatcher
// ---------------------------------------------------------------------------

describe('createDispatcher', () => {

  describe('ongoing dispatch', () => {
    it('pointerdown calls invoker.start and stores OngoingHandle', () => {
      const handle = { onMove: vi.fn(), onEnd: vi.fn() };
      const startFn = vi.fn().mockReturnValue(handle);
      const action = ongoingAction('drag-action', { kind: 'drag' }, startFn);
      const registry = makeRegistry([action]);
      const dispatcher = createDispatcher();

      const pointerdownEvent: InputEvent = {
        kind: 'pointerdown',
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      };

      const result = dispatcher.handleInput(pointerdownEvent, makeCtx({ actions: registry }));
      expect(result).toBe('handled');
      expect(startFn).toHaveBeenCalledOnce();
    });

    it('inFlight() shows the active handle', () => {
      const handle = { onMove: vi.fn(), onEnd: vi.fn() };
      const startFn = vi.fn().mockReturnValue(handle);
      const action = ongoingAction('drag-action', { kind: 'drag' }, startFn);
      const registry = makeRegistry([action]);
      const dispatcher = createDispatcher();

      const pointerdownEvent: InputEvent = {
        kind: 'pointerdown',
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      };

      dispatcher.handleInput(pointerdownEvent, makeCtx({ actions: registry }));
      expect(dispatcher.inFlight().size).toBe(1);
    });

    it('cancelAll calls onEnd("cancel") on every handle and clears map', () => {
      const handle = { onEnd: vi.fn() };
      const startFn = vi.fn().mockReturnValue(handle);
      const action = ongoingAction('drag-action', { kind: 'drag' }, startFn);
      const registry = makeRegistry([action]);
      const dispatcher = createDispatcher();

      const pointerdownEvent: InputEvent = {
        kind: 'pointerdown',
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      };

      dispatcher.handleInput(pointerdownEvent, makeCtx({ actions: registry }));
      expect(dispatcher.inFlight().size).toBe(1);

      dispatcher.cancelAll('cancel');
      expect(handle.onEnd).toHaveBeenCalledWith(expect.anything(), 'cancel');
      expect(dispatcher.inFlight().size).toBe(0);
    });

    describe('change signal (subscribe + getVersion)', () => {
      const pointer = (kind: 'pointerdown' | 'pointermove' | 'pointerup'): InputEvent => ({
        kind, x: 0, y: 0, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
      } as InputEvent);

      /** Dispatcher with one drag action in flight-able state, plus its ctx. */
      function dragSetup() {
        const handle = { onMove: vi.fn(), onEnd: vi.fn() };
        const action = ongoingAction('drag-action', { kind: 'drag' }, vi.fn().mockReturnValue(handle));
        const ctx = makeCtx({ actions: makeRegistry([action]) });
        return { dispatcher: createDispatcher(), ctx };
      }

      it('starts at version 0 and holds steady while nothing pumps', () => {
        const dispatcher = createDispatcher();
        expect(dispatcher.getVersion()).toBe(0);
        expect(dispatcher.getVersion()).toBe(0);
      });

      it('fires and bumps on gesture start, each pump, and end', () => {
        const { dispatcher, ctx } = dragSetup();
        const sub = vi.fn();
        dispatcher.subscribe(sub);

        dispatcher.handleInput(pointer('pointerdown'), ctx);
        expect(sub).toHaveBeenCalledTimes(1);
        expect(dispatcher.getVersion()).toBe(1);

        dispatcher.handleInput(pointer('pointermove'), ctx);
        dispatcher.handleInput(pointer('pointermove'), ctx);
        expect(sub).toHaveBeenCalledTimes(3);
        expect(dispatcher.getVersion()).toBe(3);

        dispatcher.handleInput(pointer('pointerup'), ctx);
        expect(sub).toHaveBeenCalledTimes(4);
        expect(dispatcher.getVersion()).toBe(4);
      });

      it('bumps on cancelAll', () => {
        const { dispatcher, ctx } = dragSetup();
        dispatcher.handleInput(pointer('pointerdown'), ctx);
        const before = dispatcher.getVersion();
        dispatcher.cancelAll('cancel');
        expect(dispatcher.getVersion()).toBe(before + 1);
      });

      it('the new version is already visible inside the subscriber callback', () => {
        // useSyncExternalStore re-reads the snapshot synchronously on notify.
        const { dispatcher, ctx } = dragSetup();
        const seen: number[] = [];
        dispatcher.subscribe(() => { seen.push(dispatcher.getVersion()); });
        dispatcher.handleInput(pointer('pointerdown'), ctx);
        expect(seen).toEqual([1]);
      });

      it('unsubscribe stops delivery but the version keeps advancing', () => {
        const { dispatcher, ctx } = dragSetup();
        const sub = vi.fn();
        const unsubscribe = dispatcher.subscribe(sub);

        dispatcher.handleInput(pointer('pointerdown'), ctx);
        expect(sub).toHaveBeenCalledTimes(1);

        unsubscribe();
        dispatcher.handleInput(pointer('pointermove'), ctx);
        expect(sub).toHaveBeenCalledTimes(1);
        expect(dispatcher.getVersion()).toBe(2);
      });

      it('bumps once per pump mid-gesture even when the event matches nothing', () => {
        // Documented contract: it fires on the pump, not on a diff.
        const { dispatcher, ctx } = dragSetup();
        dispatcher.handleInput(pointer('pointerdown'), ctx);
        const before = dispatcher.getVersion();
        expect(dispatcher.handleInput(keyAEvent, ctx)).toBe('unhandled');
        expect(dispatcher.getVersion()).toBe(before + 1);
      });
    });

    describe('getActiveAction', () => {
      it('returns { kind: null, id: null } when nothing in flight', () => {
        const dispatcher = createDispatcher();
        expect(dispatcher.getActiveAction()).toEqual({ kind: null, id: null });
      });

      it("reports the in-flight handle's kind and the internal gestureId", () => {
        const handle = { kind: 'marquee', onMove: vi.fn(), onEnd: vi.fn() };
        const startFn = vi.fn().mockReturnValue(handle);
        const action = ongoingAction('marquee-action', { kind: 'drag' }, startFn);
        const registry = makeRegistry([action]);
        const dispatcher = createDispatcher();

        dispatcher.handleInput(
          { kind: 'pointerdown', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false },
          makeCtx({ actions: registry }),
        );
        expect(dispatcher.getActiveAction()).toEqual({ kind: 'marquee', id: 'pointer-mouse' });
      });

      it('reports kind: null when the in-flight handle did not declare one', () => {
        const handle = { onMove: vi.fn(), onEnd: vi.fn() };
        const startFn = vi.fn().mockReturnValue(handle);
        const action = ongoingAction('anon-action', { kind: 'drag' }, startFn);
        const registry = makeRegistry([action]);
        const dispatcher = createDispatcher();

        dispatcher.handleInput(
          { kind: 'pointerdown', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false },
          makeCtx({ actions: registry }),
        );
        expect(dispatcher.getActiveAction()).toEqual({ kind: null, id: 'pointer-mouse' });
      });

      it('clears after pointerup', () => {
        const handle = { kind: 'marquee', onMove: vi.fn(), onEnd: vi.fn() };
        const startFn = vi.fn().mockReturnValue(handle);
        const action = ongoingAction('marquee-action', { kind: 'drag' }, startFn);
        const registry = makeRegistry([action]);
        const dispatcher = createDispatcher();
        const ctx = makeCtx({ actions: registry });

        dispatcher.handleInput(
          { kind: 'pointerdown', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false },
          ctx,
        );
        dispatcher.handleInput(
          { kind: 'pointerup', x: 0, y: 0, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false },
          ctx,
        );
        expect(dispatcher.getActiveAction()).toEqual({ kind: null, id: null });
      });

      it('keys the gestureId to the event\'s pointerId', () => {
        const handle = { kind: 'marquee', onMove: vi.fn(), onEnd: vi.fn() };
        const action = ongoingAction('marquee-action', { kind: 'drag' }, vi.fn().mockReturnValue(handle));
        const dispatcher = createDispatcher();

        dispatcher.handleInput(
          { kind: 'pointerdown', pointerId: 7, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false },
          makeCtx({ actions: makeRegistry([action]) }),
        );
        expect(dispatcher.getActiveAction()).toEqual({ kind: 'marquee', id: 'pointer-7' });
      });
    });

    describe('per-pointer gesture handles', () => {
      it('two pointers open two independent handles', () => {
        // Before pointerId threading, `gestureIdFor` returned the literal
        // `pointer-mouse` for every pointer, so the second press found the
        // first's handle already in flight and silently no-oped.
        const handleA = { kind: 'move', onMove: vi.fn(), onEnd: vi.fn() };
        const handleB = { kind: 'move', onMove: vi.fn(), onEnd: vi.fn() };
        const startFn = vi.fn()
          .mockReturnValueOnce(handleA)
          .mockReturnValueOnce(handleB);
        const action = ongoingAction('move', { kind: 'drag' }, startFn);
        const dispatcher = createDispatcher();
        const ctx = makeCtx({ actions: makeRegistry([action]) });
        const down = (pointerId: number): InputEvent => ({
          kind: 'pointerdown', pointerId, x: 0, y: 0,
          altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
        });

        dispatcher.handleInput(down(1), ctx);
        dispatcher.handleInput(down(2), ctx);

        expect(startFn).toHaveBeenCalledTimes(2);
        expect([...dispatcher.inFlight().keys()].sort()).toEqual(['pointer-1', 'pointer-2']);
      });

      it('pumps and ends each pointer\'s handle independently', () => {
        const handleA = { kind: 'move', onMove: vi.fn(), onEnd: vi.fn() };
        const handleB = { kind: 'move', onMove: vi.fn(), onEnd: vi.fn() };
        const startFn = vi.fn()
          .mockReturnValueOnce(handleA)
          .mockReturnValueOnce(handleB);
        const action = ongoingAction('move', { kind: 'drag' }, startFn);
        const dispatcher = createDispatcher();
        const ctx = makeCtx({ actions: makeRegistry([action]) });
        const mods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };

        dispatcher.handleInput({ kind: 'pointerdown', pointerId: 1, x: 0, y: 0, ...mods }, ctx);
        dispatcher.handleInput({ kind: 'pointerdown', pointerId: 2, x: 0, y: 0, ...mods }, ctx);
        dispatcher.handleInput({ kind: 'pointermove', pointerId: 1, x: 10, y: 0, ...mods }, ctx);

        expect(handleA.onMove).toHaveBeenCalledTimes(1);
        expect(handleB.onMove).not.toHaveBeenCalled();

        dispatcher.handleInput({ kind: 'pointerup', pointerId: 1, x: 10, y: 0, ...mods }, ctx);

        expect(handleA.onEnd).toHaveBeenCalledTimes(1);
        expect(handleB.onEnd).not.toHaveBeenCalled();
        expect([...dispatcher.inFlight().keys()]).toEqual(['pointer-2']);
      });

      it('keys events with no pointerId to `pointer-mouse`', () => {
        // Synthesized events (tests, programmatic drags, the hover pump's
        // resolveOnly probe) carry no pointerId and share one slot, which is
        // exactly the pre-threading behavior.
        const handle = { kind: 'marquee', onMove: vi.fn(), onEnd: vi.fn() };
        const action = ongoingAction('marquee', { kind: 'drag' }, vi.fn().mockReturnValue(handle));
        const dispatcher = createDispatcher();

        dispatcher.handleInput(
          { kind: 'pointerdown', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false },
          makeCtx({ actions: makeRegistry([action]) }),
        );
        expect([...dispatcher.inFlight().keys()]).toEqual(['pointer-mouse']);
      });
    });

    it('key-held down starts a handle; up calls onEnd("commit") and clears', () => {
      const handle = { onEnd: vi.fn() };
      const startFn = vi.fn().mockReturnValue(handle);
      const action = ongoingAction('space-held', { kind: 'key-held', key: ' ' }, startFn);
      const registry = makeRegistry([action]);
      const dispatcher = createDispatcher();

      const downEvent: InputEvent = {
        kind: 'key-held',
        key: ' ',
        phase: 'down',
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      };
      const upEvent: InputEvent = {
        kind: 'key-held',
        key: ' ',
        phase: 'up',
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      };

      const ctx = makeCtx({ actions: registry });
      dispatcher.handleInput(downEvent, ctx);
      expect(dispatcher.inFlight().size).toBe(1);
      expect(startFn).toHaveBeenCalledOnce();

      dispatcher.handleInput(upEvent, ctx);
      expect(handle.onEnd).toHaveBeenCalledWith(expect.anything(), 'commit');
      expect(dispatcher.inFlight().size).toBe(0);
    });
  });
});
