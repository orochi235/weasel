/**
 * Pipeline groups in a real browser: a stage dragged into a group's box joins it and Undo takes it
 * back out, and Arrange's Group and Ungroup, by menu and by key, change what groups hold.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { fitViewToBounds, viewToTransform, type RectPose } from '@weasel-js/core';
import { diagramScene } from '@weasel-js/diagram';
import { EFFECT_MIN_SCALE, editorScene, type EffectDoc, type EffectGroup } from '@weasel-js/diagram/effect';
import { registerCanvasFont } from '@weasel-js/font';
import { isApplePlatform } from '@weasel-js/gestures';
import '@weasel-js/theme/tokens.css';
import { choose } from '../testing/choose';
import { mountChartApp, unmountChartApp } from '../testing/mountChartApp';
import { PIPELINE_STORAGE_KEY } from './usePipelineDoc';

registerCanvasFont('sans-serif');

const img = (id: string) => ({ id, title: id, inputs: [{ id: 'image', type: 'image' }], outputs: [{ id: 'out', type: 'image' }] });
const DOC: EffectDoc = {
  pipeline: { stages: [img('a'), img('b')], wires: [], groups: [{ id: 'g', label: 'Filters', members: ['a'] }], types: { number: { control: true } } },
  places: { a: { x: 40, y: 60 }, b: { x: 560, y: 60 } },
  groupBoxes: { g: { x: 0, y: 0, width: 400, height: 300 } },
};

beforeEach(async () => {
  await page.viewport(1280, 800);
  localStorage.clear();
  localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(DOC));
});

afterEach(() => {
  unmountChartApp();
  localStorage.clear();
});

/** The groups the pipeline doc last saved. */
const groups = (): readonly EffectGroup[] => (JSON.parse(localStorage.getItem(PIPELINE_STORAGE_KEY)!) as EffectDoc).pipeline.groups ?? [];

/** The canvas, and where a world point is on it in client pixels, in the view the editor opens on. */
async function openCanvas() {
  await mountChartApp();
  await choose('Mode', /^Pipeline/);
  await new Promise((r) => setTimeout(r, 100));
  const canvas = document.querySelector<HTMLCanvasElement>('.wc-host canvas')!;
  const r = canvas.getBoundingClientRect();
  const built = editorScene(DOC);
  const boxes = diagramScene(built.data, built.scene).filter((s) => s.kind === 'container').map((s) => s.pose as RectPose);
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const bounds = { x: left, y: top, width: Math.max(...boxes.map((b) => b.x + b.width)) - left, height: Math.max(...boxes.map((b) => b.y + b.height)) - top };
  const t = viewToTransform(fitViewToBounds(bounds, { width: r.width, height: r.height }, { x: 0, y: 0, scale: { x: 1, y: 1 } }, {
    maxScale: 1, minScale: EFFECT_MIN_SCALE, anchor: 'start',
  }));
  const at = (x: number, y: number) => ({ x: t.panX + x * t.zoom.x, y: t.panY + y * t.zoom.y });
  const fire = (type: string, p: { x: number; y: number }) => canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: r.left + p.x, clientY: r.top + p.y,
  }));
  const drag = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    fire('pointermove', from);
    fire('pointerdown', from);
    for (let i = 1; i <= 10; i++) fire('pointermove', { x: from.x + (to.x - from.x) * i / 10, y: from.y + (to.y - from.y) * i / 10 });
    fire('pointerup', to);
  };
  return { canvas, at, drag };
}

describe('WeaselChart pipeline groups', () => {
  it('moves a stage dragged into a group box into the group, and Edit › Undo takes it back out', async () => {
    const { at, drag } = await openCanvas();
    drag(at(600, 70), at(200, 200));
    await expect.poll(() => groups().find((g) => g.id === 'g')?.members).toEqual(['a', 'b']);
    await choose('Edit', /^Undo/);
    await expect.poll(() => groups().find((g) => g.id === 'g')?.members).toEqual(['a']);
  });

  it('groups the picked stage from Arrange › Group, shows the group in Params, and ungroups it by key', async () => {
    const { canvas, at } = await openCanvas();
    const b = at(600, 70);
    await userEvent.click(canvas, { position: b });
    await choose('Arrange', /^Group/);
    await expect.poll(() => groups().map((g) => g.id)).toEqual(['g', 'group']);
    expect(groups()[1]!.members).toEqual(['b']);
    await expect.element(page.getByRole('textbox', { name: 'Name' })).toBeVisible();

    await userEvent.keyboard(isApplePlatform() ? '{Meta>}{Shift>}g{/Shift}{/Meta}' : '{Control>}{Shift>}g{/Shift}{/Control}');
    await expect.poll(() => groups().map((g) => g.id)).toEqual(['g']);
  });

  it('groups the picked stage by Mod+G, as one step Edit › Undo takes back', async () => {
    const { canvas, at } = await openCanvas();
    await userEvent.click(canvas, { position: at(600, 70) });
    await userEvent.keyboard(isApplePlatform() ? '{Meta>}g{/Meta}' : '{Control>}g{/Control}');
    await expect.poll(() => groups().map((g) => g.id)).toEqual(['g', 'group']);
    await choose('Edit', /^Undo/);
    await expect.poll(() => JSON.parse(localStorage.getItem(PIPELINE_STORAGE_KEY)!)).toEqual(DOC);
  });
});
