/** A HUD on a mounted `<SceneCanvas>`, driven by real pointer events through its dispatcher. */
import { vi } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { ActionsProvider, SceneCanvas, useScene, useSelection } from '@weasel-js/core';
import type { SceneCanvasApi } from '@weasel-js/core';
import { KitSettingsProvider } from '@weasel-js/react';
import { useHud, useHudContribution } from './react';
import type { HudPointerEvent, Widget } from './widget';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';

interface Empty { id: string }

/** The `gestures` kit settings a mount runs under; unset leaves the kit defaults. */
export interface GestureSettings { longPressMs?: number; dragPx?: number }

function Harness({ widget, gestures }: { widget: Widget; gestures?: GestureSettings }) {
  const ref = React.useRef<SceneCanvasApi>(null);
  const hud = useHud(ref);
  React.useEffect(() => { hud.add(widget); }, [hud, widget]);
  const hudTool = useHudContribution();
  const scene = useScene<Empty>({ items: [] });
  const selection = useSelection();
  const canvas = (
    <ActionsProvider>
      <SceneCanvas ref={ref} width={200} height={200} scene={scene} selection={selection} layers={{}} ambient={[hudTool]} />
    </ActionsProvider>
  );
  if (!gestures) return canvas;
  return <KitSettingsProvider value={{ gestures } as never}>{canvas}</KitSettingsProvider>;
}

/** Stubs the font loads a HUD mount makes. Call in `beforeEach`. */
export function stubHudFonts(): void {
  _resetFontRegistryForTests();
  global.fetch = vi.fn(async () => new Response('{"common":{"lineHeight":1},"info":{"face":"x","size":1},"chars":[],"kernings":[]}')) as never;
  global.createImageBitmap = vi.fn(async () => ({} as ImageBitmap));
}

/** Mount a HUD canvas holding `widget`; returns the canvas element. */
export async function mountHud(widget: Widget, gestures?: GestureSettings): Promise<HTMLCanvasElement> {
  const { container } = render(<Harness widget={widget} gestures={gestures} />);
  await act(async () => {});
  return container.querySelector('canvas')!;
}

/** A primary-button pointer event of `pointerType` at a client point. */
export function pointer(type: string, pointerType: string, clientX: number, clientY: number): PointerEvent {
  const ev = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.assign(ev, { pointerId: 7, pointerType, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX, clientY });
  return ev;
}

export function send(canvas: Element, ev: Event): void {
  act(() => { canvas.dispatchEvent(ev); });
}

export const types = (seen: readonly HudPointerEvent[]): string[] => seen.map((e) => e.type);
