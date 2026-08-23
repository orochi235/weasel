import { describe, it, expect } from 'vitest';
import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { WeaselProvider, useActionsRegistry, useGestureDispatcher } from '@weasel-js/core';
import { usePlatformerInput, type HeldInput } from '../platformer/useInput';

// `usePlatformerInput` only registers the `platformer.hold` action into the
// registry — routing window keydown/keyup into it is the gesture
// dispatcher's job, which `<SceneCanvas>` mounts in the real app.
// `<WeaselProvider>` alone doesn't mount one, so the harness mounts the same
// public `useGestureDispatcher` hook directly, the way SceneCanvas-free
// dispatcher tests elsewhere in the kit do.
function MountDispatcher() {
  const registry = useActionsRegistry();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useGestureDispatcher({ canvasRef, actions: registry!, toolsById: new Map() });
  return null;
}

function Harness({ onReady }: { onReady: (ref: { current: HeldInput }) => void }) {
  const input = usePlatformerInput();
  onReady(input);
  return (
    <>
      <MountDispatcher />
      <div data-testid="harness" />
    </>
  );
}

function mount() {
  let ref!: { current: HeldInput };
  render(
    <WeaselProvider>
      <Harness onReady={(r) => { ref = r; }} />
    </WeaselProvider>,
  );
  return ref;
}

const key = (type: 'keydown' | 'keyup', k: string) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true }));
  });

describe('usePlatformerInput', () => {
  it('starts with nothing held', () => {
    const input = mount();
    expect(input.current).toEqual({ left: false, right: false, jumpHeld: false, jumpPressed: false });
  });

  it('tracks a held direction from keydown to keyup', () => {
    const input = mount();
    key('keydown', 'ArrowRight');
    expect(input.current.right).toBe(true);
    key('keyup', 'ArrowRight');
    expect(input.current.right).toBe(false);
  });

  it('accepts the WASD aliases', () => {
    const input = mount();
    key('keydown', 'a');
    expect(input.current.left).toBe(true);
    key('keyup', 'a');
    key('keydown', 'd');
    expect(input.current.right).toBe(true);
  });

  it('holds jump on space', () => {
    const input = mount();
    key('keydown', ' ');
    expect(input.current.jumpHeld).toBe(true);
    key('keyup', ' ');
    expect(input.current.jumpHeld).toBe(false);
  });

  it('clears everything on window blur so a held key cannot stick', () => {
    const input = mount();
    key('keydown', 'ArrowLeft');
    key('keydown', ' ');
    expect(input.current.left).toBe(true);
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(input.current).toEqual({ left: false, right: false, jumpHeld: false, jumpPressed: false });
  });
});
