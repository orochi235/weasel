/**
 * Audio pipelines in a real browser: a stage set picked in the palette, wired on the canvas, played
 * from the Run menu with its previews drawn as a scope or a spectrum, and its engine closed with the mode.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { IDENTITY_POSE_COMPOSITION } from '@weasel-js/core';
import type { RectPose } from '@weasel-js/core';
import { diagramScene, portsOf } from '@weasel-js/diagram';
import { editorScene, previewRowId, type EffectDoc } from '@weasel-js/diagram/effect';
import { registerCanvasFont } from '@weasel-js/font';
import '@weasel-js/theme/tokens.css';
import { canvasGl } from '@weasel-js/core/testing/canvasPixels';
import { mountChartApp, unmountChartApp } from '../testing/mountChartApp';
import { PIPELINE_STORAGE_KEY } from './usePipelineDoc';

registerCanvasFont('sans-serif');

const OSC = 'audio.oscillator';
const OUT = 'audio.output';

const contexts: AudioContext[] = [];
const NativeContext = globalThis.AudioContext;

beforeEach(async () => {
  await page.viewport(1280, 800);
  localStorage.clear();
  contexts.length = 0;
  globalThis.AudioContext = class extends NativeContext {
    constructor(opts?: AudioContextOptions) {
      super(opts);
      contexts.push(this);
    }
  };
});

afterEach(() => {
  unmountChartApp();
  globalThis.AudioContext = NativeContext;
  localStorage.clear();
});

const saved = (): EffectDoc => JSON.parse(localStorage.getItem(PIPELINE_STORAGE_KEY)!) as EffectDoc;
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

async function menuItem(menu: string, row: RegExp): Promise<HTMLElement> {
  // A toggle row leaves its menu open.
  if (document.querySelector('[role="menu"]') !== null) await userEvent.keyboard('{Escape}');
  await userEvent.click(page.getByRole('menubar').getByRole('menuitem', { name: menu }));
  return [...document.querySelectorAll<HTMLElement>('[role="menu"] [role^="menuitem"]')].find((el) => row.test(el.textContent ?? ''))!;
}

async function choose(menu: string, row: RegExp): Promise<void> {
  await userEvent.click(await menuItem(menu, row));
}

/** Whether a menu row is disabled; closes the menu again. */
async function disabled(menu: string, row: RegExp): Promise<boolean> {
  const item = await menuItem(menu, row);
  const off = item.getAttribute('aria-disabled') === 'true';
  await userEvent.keyboard('{Escape}');
  return off;
}

/** A port's point on the canvas in client pixels. The editor opened on an empty pipeline, so its view is the identity. */
function portAt(stage: string, port: string): { x: number; y: number } {
  const canvas = document.querySelector<HTMLCanvasElement>('.wc-host canvas')!;
  const r = canvas.getBoundingClientRect();
  const { data, scene } = editorScene(saved());
  const s = diagramScene(data, { ...scene, composition: IDENTITY_POSE_COMPOSITION }).find((x) => x.id === stage)!;
  const p = portsOf({ id: stage, kind: s.kind, data: s.data }, s.pose as RectPose).find((x) => x.id === port)!;
  return { x: r.left + p.point.x, y: r.top + p.point.y };
}

function drag(from: { x: number; y: number }, to: { x: number; y: number }): void {
  const canvas = document.querySelector<HTMLCanvasElement>('.wc-host canvas')!;
  const fire = (type: string, x: number, y: number) => canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y,
  }));
  fire('pointerdown', from.x, from.y);
  for (let i = 1; i <= 10; i++) fire('pointermove', from.x + (to.x - from.x) * i / 10, from.y + (to.y - from.y) * i / 10);
  fire('pointerup', to.x, to.y);
}

/** The RGBA pixels of the oscillator's preview slot, read straight after a frame, as rows of columns. */
async function slotPixels(): Promise<number[][][]> {
  const canvas = document.querySelector<HTMLCanvasElement>('.wc-host canvas')!;
  const r = canvas.getBoundingClientRect();
  const drawn = editorScene(saved(), 'nodeGraph', { showValues: false, showPreviews: true });
  const box = diagramScene(drawn.data, { ...drawn.scene, composition: IDENTITY_POSE_COMPOSITION }).find((s) => s.id === `${OSC}/${previewRowId('out')}`)!.pose as RectPose;
  const dpr = canvas.width / r.width;
  // Edge to edge: a sine's spectrum is one bar at the left.
  const x = Math.round(box.x * dpr);
  const y = Math.round(box.y * dpr);
  const w = Math.round(box.width * dpr);
  const h = Math.round(box.height * dpr);
  await frame();
  const gl = canvasGl(canvas);
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(x, canvas.height - y - h, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return Array.from({ length: h }, (_, row) => Array.from({ length: w }, (_, col) => {
    const i = (row * w + col) * 4;
    return [px[i]!, px[i + 1]!, px[i + 2]!];
  }));
}

/** The share of the slot's columns holding a pixel unlike the empty slot's: about all of them for a
 *  scope's line, one or two for a sine's spectrum. */
async function inkedColumns(empty: number[][][]): Promise<number> {
  const now = await slotPixels();
  const columns = now[0]!.length;
  let inked = 0;
  for (let col = 0; col < columns; col++) {
    if (now.some((row, i) => row[col]!.some((v, c) => Math.abs(v - empty[i]![col]![c]!) > 40))) inked++;
  }
  return inked / columns;
}

describe('WeaselChart pipeline mode, audio', () => {
  it('plays an oscillator into the output, draws it as a scope or a spectrum, and closes its engine when the mode is left while it plays', async () => {
    await mountChartApp();
    await choose('Mode', /^Pipeline/);
    await userEvent.click(page.getByRole('radio', { name: 'Audio' }));
    await userEvent.click(page.getByRole('row', { name: 'Oscillator' }));
    await userEvent.click(page.getByRole('row', { name: 'Output' }));
    await expect.poll(() => saved().pipeline.stages.map((s) => s.id)).toEqual([OSC, OUT]);
    await frame();
    drag(portAt(OSC, 'out'), portAt(OUT, 'in'));
    await expect.poll(() => saved().pipeline.wires.map((w) => [w.from.stage, w.to.stage])).toEqual([[OSC, OUT]]);

    await choose('View', /Show Previews/);
    const empty = await slotPixels();
    await choose('View', /Show Previews/);
    expect(contexts).toEqual([]);

    await choose('Run', /^Play/);
    await expect.poll(() => disabled('Run', /^Pause/)).toBe(false);
    expect(await disabled('Run', /^Play/)).toBe(true);
    expect(contexts).toHaveLength(1);

    await choose('View', /Show Previews/);
    await expect.poll(() => inkedColumns(empty)).toBeGreaterThan(0.9);
    await choose('View', /Show Spectrum/);
    await expect.poll(() => inkedColumns(empty)).toBeLessThan(0.5);
    expect(await inkedColumns(empty)).toBeGreaterThan(0);

    await choose('Run', /^Pause/);
    await expect.poll(() => disabled('Run', /^Play/)).toBe(false);

    // Leaving the mode while it sounds disposes the graph and closes the engine.
    await choose('Run', /^Play/);
    await expect.poll(() => disabled('Run', /^Pause/)).toBe(false);
    await choose('Mode', /^Chart/);
    await expect.poll(() => contexts[0]!.state).toBe('closed');
  });
});
