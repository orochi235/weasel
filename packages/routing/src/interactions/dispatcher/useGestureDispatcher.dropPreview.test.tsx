/**
 * useGestureDispatcher — the preview of an OS drag in flight: while it hovers,
 * the action its drop would run is asked to show what it would do.
 * jsdom has no DragEvent, so events are plain `Event`s with fields assigned on.
 */
import { describe, it, expect, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import type { Action } from '../actions/action';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { useGestureDispatcher } from './useGestureDispatcher';

function Probe({ actionDef }: { actionDef: Action }) {
  const registry = useActionsRegistry();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  registry?.register(actionDef);
  useGestureDispatcher({ canvasRef, actions: registry!, entriesById: new Map() });
  return <canvas ref={canvasRef} />;
}

function mount(action: Action) {
  const r = render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider><Probe actionDef={action} /></ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>,
  );
  return { ...r, canvas: r.container.querySelector('canvas')! };
}

const pngDrag = { items: [{ kind: 'file', type: 'image/png', getAsFile: () => null }], types: ['Files'], files: [] };

function drag(canvas: Element, type: string, fields: Record<string, unknown> = {}): Event {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, {
    dataTransfer: pngDrag, clientX: 10, clientY: 20,
    altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
    ...fields,
  });
  act(() => { canvas.dispatchEvent(e); });
  return e;
}

function previewing(types?: string[]) {
  const hide = vi.fn();
  const preview = vi.fn(() => hide);
  const action: Action = {
    id: 'drop-probe',
    label: 'Drop probe',
    defaultBinding: [{ kind: 'drop', ...(types ? { types } : {}) }],
    invoker: { timing: 'immediate', run: () => {} },
    preview,
  };
  return { action, preview, hide };
}

describe('useGestureDispatcher — drop preview', () => {
  it('asks the action the drop would run for its preview, with the drag\'s kinds, MIMEs and point', () => {
    const { action, preview } = previewing();
    const { canvas } = mount(action);
    drag(canvas, 'dragover');
    expect(preview).toHaveBeenCalledTimes(1);
    const params = (preview.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(params.items).toEqual([{ pending: 'file', mime: 'image/png' }]);
    expect(params).toMatchObject({ via: 'drop', worldX: 10, worldY: 20 });
  });

  it('a stationary drag asks once; moving takes the last preview down and asks again', () => {
    const { action, preview, hide } = previewing();
    const { canvas } = mount(action);
    drag(canvas, 'dragenter');
    drag(canvas, 'dragover');
    drag(canvas, 'dragover');
    expect(preview).toHaveBeenCalledTimes(1);
    drag(canvas, 'dragover', { clientX: 30 });
    expect(hide).toHaveBeenCalledTimes(1);
    expect(preview).toHaveBeenCalledTimes(2);
  });

  it('takes the preview down when the drag leaves, drops, or the canvas unmounts', () => {
    const { action, hide } = previewing();
    const { canvas, unmount } = mount(action);
    drag(canvas, 'dragover');
    drag(canvas, 'dragleave');
    expect(hide).toHaveBeenCalledTimes(1);
    drag(canvas, 'dragover');
    drag(canvas, 'drop');
    expect(hide).toHaveBeenCalledTimes(2);
    drag(canvas, 'dragover');
    unmount();
    expect(hide).toHaveBeenCalledTimes(3);
  });

  it('asks nothing of a drag no binding would take', () => {
    const { action, preview } = previewing(['text/csv']);
    const { canvas } = mount(action);
    drag(canvas, 'dragover');
    expect(preview).not.toHaveBeenCalled();
  });
});
