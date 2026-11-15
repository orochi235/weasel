/**
 * What the scenario drives the editor with: the pointer and field input a person would give it, dispatched as
 * DOM events so they reach the canvas's own dispatcher, and a probe reading what the canvas installed.
 */
import { act, useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  ActionsProvider, useActionsRegistry,
  type ActionsRegistry, type FeaturePreset, type RectPose, type Scene, type SceneCanvasHit, type ToolsApi,
} from '@weasel-js/core';
import { GemEditor } from './editor.js';

export type GemScene = Scene<unknown, 'default', RectPose>;

/** What the host hands back: the canvas's tools, the actions registry the canvas registered into, and each click's hit. */
export class Probe {
  tools: ToolsApi | null = null;
  registry: ActionsRegistry | null = null;
  readonly clicks: (SceneCanvasHit | null)[] = [];
  readonly sawTools = (tools: ToolsApi) => { this.tools = tools; };
  readonly sawRegistry = (registry: ActionsRegistry | null) => { this.registry = registry; };
  readonly sawClick = (hit: SceneCanvasHit | null) => { this.clicks.push(hit); };
}

export const newProbe = () => new Probe();

function ReadRegistry({ probe }: { probe: Probe }) {
  const registry = useActionsRegistry();
  useEffect(() => probe.sawRegistry(registry), [probe, registry]);
  return null;
}

/** The editor inside an actions scope the probe reads, so a check can ask what the canvas registered. */
export function GemHost({ scene, features, probe }: { scene: GemScene; features: readonly FeaturePreset[]; probe: Probe }) {
  return (
    <ActionsProvider>
      <ReadRegistry probe={probe} />
      <GemEditor
        scene={scene} features={features}
        onToolsCreated={probe.sawTools} onClick={probe.sawClick}
      />
    </ActionsProvider>
  );
}

/** A React root in a fresh container, rendered and unmounted inside `act`. */
export function mount(ui: ReactNode): { container: HTMLElement; render(next: ReactNode): void; unmount(): void } {
  const container = document.createElement('div');
  document.body.append(container);
  let root: Root | null = null;
  act(() => {
    root = createRoot(container);
    root.render(ui);
  });
  return {
    container,
    render: (next) => act(() => root!.render(next)),
    unmount: () => {
      act(() => root!.unmount());
      container.remove();
    },
  };
}

/** Lets effects scheduled by the last render run. */
export const settle = () => act(async () => {});

/** An event made by `target`'s own window, which a DOM shim such as jsdom requires of what it dispatches. */
const eventFor = (target: Element, type: string, init: EventInit = { bubbles: true, cancelable: true }) =>
  new (target.ownerDocument.defaultView ?? globalThis).Event(type, init);

function pointer(target: Element, type: string, x: number, y: number): Event {
  const ev = eventFor(target, type);
  Object.assign(ev, { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 });
  return ev;
}

const canvasIn = (container: HTMLElement) => {
  const canvas = container.querySelector('canvas');
  if (!canvas) throw new Error('no <canvas> was mounted');
  return canvas;
};

export function drag(container: HTMLElement, from: [number, number], to: [number, number]) {
  const canvas = canvasIn(container);
  act(() => {
    canvas.dispatchEvent(pointer(canvas, 'pointerdown', ...from));
    canvas.dispatchEvent(pointer(canvas, 'pointermove', ...to));
    canvas.dispatchEvent(pointer(canvas, 'pointerup', ...to));
  });
}

export function click(container: HTMLElement, at: [number, number]) {
  const canvas = canvasIn(container);
  act(() => {
    canvas.dispatchEvent(pointer(canvas, 'pointerdown', ...at));
    canvas.dispatchEvent(pointer(canvas, 'pointerup', ...at));
  });
}

/** The input a field labeled `name` edits, by `aria-label`, a `<label>`, or `aria-labelledby`. */
export function fieldLabeled(container: HTMLElement, name: string): HTMLInputElement {
  for (const input of container.querySelectorAll('input')) {
    if (input.getAttribute('aria-label') === name) return input;
    if ([...(input.labels ?? [])].some((label) => label.textContent?.trim() === name)) return input;
    const ids = input.getAttribute('aria-labelledby')?.split(/\s+/) ?? [];
    if (ids.some((id) => document.getElementById(id)?.textContent?.trim() === name)) return input;
  }
  throw new Error(`no field labeled "${name}"`);
}

/** Types `value` into `input` and leaves it, as a person committing a field does. */
export function typeInto(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input) as HTMLInputElement, 'value')!.set!;
  act(() => {
    input.focus();
    setValue.call(input, value);
    input.dispatchEvent(eventFor(input, 'input', { bubbles: true }));
    input.dispatchEvent(eventFor(input, 'change', { bubbles: true }));
    input.blur();
  });
}
