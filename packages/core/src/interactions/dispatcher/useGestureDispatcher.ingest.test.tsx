/**
 * useGestureDispatcher — external-content ingestion DOM channels (drop,
 * dragover, paste). jsdom has no DragEvent/DataTransfer constructors, so the
 * tests construct plain `Event`s and `Object.assign` the fields the handlers
 * read (`dataTransfer`, `clientX`/`clientY`, `clipboardData`, modifiers).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useRef } from 'react';
import {
  ActionsProvider,
  useActionsRegistry,
  type Action,
} from '../actions/registry';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { useGestureDispatcher } from './useGestureDispatcher';
import type { IngestItem } from 'features/ingestion/ingestItems';

function Probe({ actionDef }: { actionDef: Action }) {
  const registry = useActionsRegistry();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  registry?.register(actionDef);
  useGestureDispatcher({
    canvasRef,
    actions: registry!,
    toolsById: new Map(),
  });
  return <canvas ref={canvasRef} />;
}

function Harness({ children }: { children: React.ReactNode }) {
  return (
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>{children}</ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>
  );
}

/** Immediate probe action whose `run` captures the merged params. */
function makeProbeAction(
  binding: Action['defaultBinding'],
  spy: (params: Record<string, unknown> | undefined) => void,
): Action {
  return {
    id: 'ingest-probe',
    label: 'Ingest probe',
    defaultBinding: binding,
    invoker: { timing: 'immediate', run: (_deps, params) => spy(params) },
  };
}

/** Build a drop Event with the fields the handler reads assigned on. */
function makeDropEvent(
  fields: Record<string, unknown>,
  type = 'drop',
): Event {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, fields);
  return e;
}

/** Flush the itemsFromDataTransfer materialization microtasks. */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('useGestureDispatcher — ingest channels', () => {
  it('drop dispatches the bound action with items + world point', async () => {
    const spy = vi.fn();
    const action = makeProbeAction([{ kind: 'drop' }], spy);
    const { container } = render(<Harness><Probe actionDef={action} /></Harness>);
    const canvas = container.querySelector('canvas')!;

    const file = new File(['x'], 'a.png', { type: 'image/png' });
    const ev = makeDropEvent({
      dataTransfer: { items: [], files: [file] },
      clientX: 12,
      clientY: 34,
      altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
    });
    act(() => { canvas.dispatchEvent(ev); });

    await vi.waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1);
    });
    const params = spy.mock.calls[0][0] as Record<string, unknown>;
    const items = params.items as IngestItem[];
    expect(items).toHaveLength(1);
    expect(items[0].mime).toBe('image/png');
    expect(params.via).toBe('drop');
    expect(typeof params.worldX).toBe('number');
    expect(typeof params.worldY).toBe('number');
  });

  it('dragover adds the dropover class; dragleave and drop remove it', async () => {
    const spy = vi.fn();
    const action = makeProbeAction([{ kind: 'drop' }], spy);
    const { container } = render(<Harness><Probe actionDef={action} /></Harness>);
    const canvas = container.querySelector('canvas')!;

    // dragover with a dataTransfer → class added
    act(() => {
      canvas.dispatchEvent(makeDropEvent({ dataTransfer: { items: [], files: [] } }, 'dragover'));
    });
    expect(canvas.classList.contains('weasel-dropover')).toBe(true);

    // dragleave → removed
    act(() => { canvas.dispatchEvent(makeDropEvent({}, 'dragleave')); });
    expect(canvas.classList.contains('weasel-dropover')).toBe(false);

    // dragover then drop (empty dataTransfer is fine) → removed after drop
    act(() => {
      canvas.dispatchEvent(makeDropEvent({ dataTransfer: { items: [], files: [] } }, 'dragover'));
    });
    expect(canvas.classList.contains('weasel-dropover')).toBe(true);
    act(() => {
      canvas.dispatchEvent(makeDropEvent({ dataTransfer: { items: [], files: [] } }));
    });
    expect(canvas.classList.contains('weasel-dropover')).toBe(false);
    await flushMicrotasks();
  });

  it('dragover without dataTransfer does nothing', () => {
    const spy = vi.fn();
    const action = makeProbeAction([{ kind: 'drop' }], spy);
    const { container } = render(<Harness><Probe actionDef={action} /></Harness>);
    const canvas = container.querySelector('canvas')!;

    const ev = makeDropEvent({}, 'dragover');
    act(() => { canvas.dispatchEvent(ev); });
    expect(canvas.classList.contains('weasel-dropover')).toBe(false);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('paste dispatches with items and no point', async () => {
    const spy = vi.fn();
    const action = makeProbeAction([{ kind: 'paste' }], spy);
    render(<Harness><Probe actionDef={action} /></Harness>);

    const file = new File(['x'], 'a.png', { type: 'image/png' });
    const ev = new Event('paste', { cancelable: true });
    Object.assign(ev, { clipboardData: { files: [file], getData: () => '' } });
    act(() => { window.dispatchEvent(ev); });

    await vi.waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1);
    });
    const params = spy.mock.calls[0][0] as Record<string, unknown>;
    const items = params.items as IngestItem[];
    expect(items).toHaveLength(1);
    expect(params.via).toBe('paste');
    expect(params.worldX).toBeUndefined();
    expect(params.worldY).toBeUndefined();
  });

  it('paste from an editable target is ignored', async () => {
    const spy = vi.fn();
    const action = makeProbeAction([{ kind: 'paste' }], spy);
    render(<Harness><Probe actionDef={action} /></Harness>);

    const input = document.createElement('input');
    document.body.appendChild(input);
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    const ev = new Event('paste', { bubbles: true, cancelable: true });
    Object.assign(ev, { clipboardData: { files: [file], getData: () => '' } });
    act(() => { input.dispatchEvent(ev); });
    await flushMicrotasks();
    expect(spy).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('empty drop dispatches nothing', async () => {
    const spy = vi.fn();
    const action = makeProbeAction([{ kind: 'drop' }], spy);
    const { container } = render(<Harness><Probe actionDef={action} /></Harness>);
    const canvas = container.querySelector('canvas')!;

    act(() => {
      canvas.dispatchEvent(makeDropEvent({
        dataTransfer: { items: [], files: [] },
        clientX: 5,
        clientY: 5,
      }));
    });
    await flushMicrotasks();
    expect(spy).not.toHaveBeenCalled();
  });

  it('preventDefault fires on handled paste, not on empty clipboard', async () => {
    const spy = vi.fn();
    const action = makeProbeAction([{ kind: 'paste' }], spy);
    render(<Harness><Probe actionDef={action} /></Harness>);

    const file = new File(['x'], 'a.png', { type: 'image/png' });
    const withItems = new Event('paste', { cancelable: true });
    Object.assign(withItems, { clipboardData: { files: [file], getData: () => '' } });
    act(() => { window.dispatchEvent(withItems); });
    expect(withItems.defaultPrevented).toBe(true);

    const empty = new Event('paste', { cancelable: true });
    Object.assign(empty, { clipboardData: { files: [], getData: () => '' } });
    act(() => { window.dispatchEvent(empty); });
    expect(empty.defaultPrevented).toBe(false);
    await flushMicrotasks();
  });
});
