/** A canvas rendered into another document hears its keys' releases and blur on that document's window. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { giveKeys } from '@weasel-js/react/testing/giveKeys';
import { useGestureDispatcher } from './useGestureDispatcher';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import type { Action } from '../actions/action';
import { heldKeySpec } from '../actions/toolOffhand';

afterEach(() => { document.body.replaceChildren(); });

function Canvas({ held, keyboard }: { held: (on: boolean) => void; keyboard: true | 'page' }): ReactNode {
  const registry = useActionsRegistry()!;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => registry.register({
    id: 'test.hold', label: 'Hold',
    defaultBinding: heldKeySpec('Alt'),
    invoker: { timing: 'ongoing', start: () => { held(true); return { onEnd: () => held(false) }; } },
  } satisfies Action), [registry, held]);
  useGestureDispatcher({ canvasRef, actions: registry, entriesById: new Map(), keyboard });
  return <canvas ref={canvasRef} />;
}

function inFrame(held: (on: boolean) => void, keyboard: true | 'page'): Window {
  const frame = document.createElement('iframe');
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  render(
    <DepRegistryProvider><ActionsProvider><ActiveToolContextProvider>
      <Canvas held={held} keyboard={keyboard} />
    </ActiveToolContextProvider></ActionsProvider></DepRegistryProvider>,
    { container: doc.body.appendChild(doc.createElement('div')) },
  );
  giveKeys(doc.querySelector('canvas'));
  return frame.contentWindow!;
}

/** The frame's own event constructors: jsdom refuses an event made in another window. */
const realm = (win: Window): { KeyboardEvent: typeof KeyboardEvent; Event: typeof Event } =>
  win as unknown as { KeyboardEvent: typeof KeyboardEvent; Event: typeof Event };

const key = (win: Window, type: 'keydown' | 'keyup'): void => {
  const { KeyboardEvent: FrameKeyboardEvent } = realm(win);
  act(() => {
    win.document.body.dispatchEvent(new FrameKeyboardEvent(type, { key: 'Alt', code: 'AltLeft', altKey: type === 'keydown', bubbles: true, cancelable: true }));
  });
};

describe.each([true, 'page'] as const)('a canvas in an iframe with keyboard: %s', (keyboard) => {
  it('ends a held key when its keyup reaches the frame', () => {
    const held = vi.fn();
    const win = inFrame(held, keyboard);
    key(win, 'keydown');
    expect(held.mock.calls).toEqual([[true]]);
    key(win, 'keyup');
    expect(held.mock.calls).toEqual([[true], [false]]);
  });

  it('ends a held key when the frame loses focus', () => {
    const held = vi.fn();
    const win = inFrame(held, keyboard);
    key(win, 'keydown');
    act(() => { win.dispatchEvent(new (realm(win).Event)('blur')); });
    expect(held.mock.calls).toEqual([[true], [false]]);
  });
});
