/**
 * Pipeline mode in a real browser: the Edit menu and the undo keys reach the pipeline doc through
 * the editor's own canvas, and the Run menu draws runs on it.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { IDENTITY_POSE_COMPOSITION, fitViewToBounds, viewToTransform, type RectPose } from '@weasel-js/core';
import { diagramGroupOf, diagramScene, isBodyOrRegion } from '@weasel-js/diagram';
import {
  AT_COLOR, EFFECT_MIN_SCALE, IMAGE_STAGE_TYPES, editorScene, mainChain, previewRowId, setLookRoute, stageFromType, wireEnds,
  type EffectDoc,
} from '@weasel-js/diagram/effect';
import { registerCanvasFont } from '@weasel-js/font';
import { isApplePlatform } from '@weasel-js/gestures';
import '@weasel-js/theme/tokens.css';
import { makeChoose } from '../testing/choose';
import { mountChartApp, unmountChartApp } from '../testing/mountChartApp';
import { PIPELINE_STORAGE_KEY } from './usePipelineDoc';
import { canvasGl } from '@weasel-js/core/testing/canvasPixels';

registerCanvasFont('sans-serif');

const choose = makeChoose((el) => userEvent.click(el));

beforeEach(async () => {
  await page.viewport(1280, 800);
  localStorage.clear();
});

afterEach(() => {
  unmountChartApp();
  localStorage.clear();
});

/** The stage ids the pipeline doc last saved. */
function stages(): string[] {
  const raw = localStorage.getItem(PIPELINE_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as { pipeline: { stages: { id: string }[] } }).pipeline.stages.map((s) => s.id) : [];
}

/** The main line of the pipeline the doc last saved. */
function chain(): string[] {
  const raw = localStorage.getItem(PIPELINE_STORAGE_KEY);
  return raw ? mainChain((JSON.parse(raw) as EffectDoc).pipeline) : [];
}

describe('WeaselChart pipeline mode', () => {
  it('deletes the selected stage from Edit › Delete, and Mod+Z on the canvas brings it back', async () => {
    await mountChartApp();
    await choose('Mode', /^Pipeline/);
    await expect.element(page.getByRole('grid', { name: 'Stages' })).toBeVisible();
    await userEvent.click(page.getByRole('row', { name: 'Source' }));
    await userEvent.click(page.getByRole('row', { name: 'Blur' }));
    await expect.poll(stages).toEqual(['source', 'blur']);
    // A stage added from the palette is selected.
    await expect.element(page.getByText('Blur params')).toBeVisible();

    await choose('Edit', /^Delete/);
    await expect.poll(stages).toEqual(['source']);

    // A click on open canvas, below the stages, focuses it; real key presses, so the held modifier registers.
    const canvas = document.querySelector<HTMLCanvasElement>('.wc-host canvas')!;
    const { width, height } = canvas.getBoundingClientRect();
    await userEvent.click(canvas, { position: { x: width - 20, y: height - 20 } });
    await userEvent.keyboard(isApplePlatform() ? '{Meta>}z{/Meta}' : '{Control>}z{/Control}');
    await expect.poll(stages).toEqual(['source', 'blur']);
  });

  it('switches to the rack look, splices a stage further along the line by dragging it, and undoes that', async () => {
    const img = (id: string) => ({ id, title: id, inputs: [{ id: 'image', type: 'image' }], outputs: [{ id: 'out', type: 'image' }] });
    const doc: EffectDoc = {
      pipeline: {
        stages: [{ id: 'src', title: 'Source', kind: 'source', outputs: [{ id: 'out', type: 'image' }] }, img('a'), img('b')],
        wires: [
          { id: 'w1', from: { stage: 'src', port: 'out' }, to: { stage: 'a', port: 'image' } },
          { id: 'w2', from: { stage: 'a', port: 'out' }, to: { stage: 'b', port: 'image' } },
        ],
      },
      places: {},
    };
    localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(doc));
    await mountChartApp();
    await choose('Mode', /^Pipeline/);
    await userEvent.click(page.getByRole('menubar').getByRole('menuitem', { name: 'View' }));
    await userEvent.click([...document.querySelectorAll<HTMLElement>('[role="menu"] [role^="menuitem"]')].find((el) => /^Look/.test(el.textContent ?? ''))!);
    await userEvent.click([...document.querySelectorAll<HTMLElement>('[role="menu"] [role^="menuitem"]')].find((el) => /^Rack/.test(el.textContent ?? ''))!);
    await new Promise((r) => setTimeout(r, 100));

    const canvas = document.querySelector<HTMLCanvasElement>('.wc-host canvas')!;
    const r = canvas.getBoundingClientRect();
    const built = editorScene(doc, 'rack');
    const specs = diagramScene(built.data, { ...built.scene, composition: IDENTITY_POSE_COMPOSITION });
    const box = (id: string) => specs.find((s) => s.id === id)!.pose as RectPose;
    // The view the editor opens on: every stage in view, at most at scale 1, from the top-left.
    const all = ['src', 'a', 'b'].map(box);
    const left = Math.min(...all.map((b) => b.x));
    const top = Math.min(...all.map((b) => b.y));
    const bounds = { x: left, y: top, width: Math.max(...all.map((b) => b.x + b.width)) - left, height: Math.max(...all.map((b) => b.y + b.height)) - top };
    const t = viewToTransform(fitViewToBounds(bounds, { width: r.width, height: r.height }, { x: 0, y: 0, scale: { x: 1, y: 1 } }, {
      maxScale: 1, minScale: EFFECT_MIN_SCALE, anchor: 'start',
    }));
    const at = (x: number, y: number) => ({ x: r.left + t.panX + x * t.zoom.x, y: r.top + t.panY + y * t.zoom.y });
    const from = at(box('a').x + box('a').width / 2, box('a').y + box('a').height / 2);
    const to = at(box('b').x + box('b').width + 20, box('a').y + box('a').height / 2);
    const fire = (type: string, p: { x: number; y: number }) => canvas.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
      button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: p.x, clientY: p.y,
    }));
    fire('pointerdown', from);
    for (let i = 1; i <= 10; i++) fire('pointermove', { x: from.x + (to.x - from.x) * i / 10, y: from.y });
    fire('pointerup', to);
    await expect.poll(chain).toEqual(['src', 'b', 'a']);

    await choose('Edit', /^Undo/);
    await expect.poll(chain).toEqual(['src', 'a', 'b']);
  });

  it('gives a wire routed under Rack back to the look from Format › Connector › Reset route, and undoes that', async () => {
    const img = (id: string) => ({ id, title: id, inputs: [{ id: 'image', type: 'image' }], outputs: [{ id: 'out', type: 'image' }] });
    const plain: EffectDoc = {
      pipeline: {
        stages: [{ id: 'src', title: 'Source', kind: 'source', outputs: [{ id: 'out', type: 'image' }] }, img('a'), img('b')],
        wires: [
          { id: 'w1', from: { stage: 'src', port: 'out' }, to: { stage: 'a', port: 'image' } },
          { id: 'w2', from: { stage: 'a', port: 'out' }, to: { stage: 'b', port: 'image' } },
        ],
      },
      places: {},
    };
    const built = editorScene(plain, 'rack');
    const specs = diagramScene(built.data, { ...built.scene, composition: IDENTITY_POSE_COMPOSITION });
    const ends = wireEnds(specs, 'w2')!;
    const bend = { x: (ends[0].x + ends[1].x) / 2, y: ends[0].y + 60 };
    localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(setLookRoute(plain, 'rack', 'w2', [bend], ends)));
    const routes = () => (JSON.parse(localStorage.getItem(PIPELINE_STORAGE_KEY)!) as EffectDoc).lookRoutes;
    await mountChartApp();
    await choose('Mode', /^Pipeline/);
    await userEvent.click(page.getByRole('menubar').getByRole('menuitem', { name: 'View' }));
    await userEvent.click([...document.querySelectorAll<HTMLElement>('[role="menu"] [role^="menuitem"]')].find((el) => /^Look/.test(el.textContent ?? ''))!);
    await userEvent.click([...document.querySelectorAll<HTMLElement>('[role="menu"] [role^="menuitem"]')].find((el) => /^Rack/.test(el.textContent ?? ''))!);
    await new Promise((r) => setTimeout(r, 100));

    const canvas = document.querySelector<HTMLCanvasElement>('.wc-host canvas')!;
    const r = canvas.getBoundingClientRect();
    // The fit takes in the wire's waypoint as well as the stages.
    const all = [...['src', 'a', 'b'].map((id) => specs.find((s) => s.id === id)!.pose as RectPose), { ...bend, width: 0, height: 0 }];
    const left = Math.min(...all.map((b) => b.x));
    const top = Math.min(...all.map((b) => b.y));
    const bounds = { x: left, y: top, width: Math.max(...all.map((b) => b.x + b.width)) - left, height: Math.max(...all.map((b) => b.y + b.height)) - top };
    const t = viewToTransform(fitViewToBounds(bounds, { width: r.width, height: r.height }, { x: 0, y: 0, scale: { x: 1, y: 1 } }, {
      maxScale: 1, minScale: EFFECT_MIN_SCALE, anchor: 'start',
    }));
    // The wire passes through its waypoint, so a click there picks it.
    await userEvent.click(canvas, { position: { x: t.panX + bend.x * t.zoom.x, y: t.panY + bend.y * t.zoom.y } });

    await choose('Format', /^Connector/);
    const reset = [...document.querySelectorAll<HTMLElement>('[role="menu"] [role^="menuitem"]')].find((el) => /^Reset route/.test(el.textContent ?? ''))!;
    await userEvent.click(reset);
    await expect.poll(routes).toBeUndefined();

    await choose('Edit', /^Undo/);
    await expect.poll(() => routes()?.rack?.w2?.waypoints).toEqual([bend]);
  });

  it('places stages added from the palette inside the view, clear of each other', async () => {
    await mountChartApp();
    await choose('Mode', /^Pipeline/);
    for (const name of ['Source', 'Blur', 'Composite']) await userEvent.click(page.getByRole('row', { name }));
    await expect.poll(stages).toHaveLength(3);
    const places = (JSON.parse(localStorage.getItem(PIPELINE_STORAGE_KEY)!) as { places: Record<string, { x: number; y: number }> }).places;
    const xs = ['source', 'blur', 'composite'].map((id) => places[id]!.x);
    expect(xs[0]).toBeGreaterThan(0);
    expect(xs[1]).toBeGreaterThan(xs[0]!);
    expect(xs[2]).toBeGreaterThan(xs[1]!);
    expect(Math.max(...xs)).toBeLessThan(document.querySelector('.wc-host')!.getBoundingClientRect().width);
  });

  describe('Run menu', () => {
    const typed = (type: string, id: string) => stageFromType(IMAGE_STAGE_TYPES.find((t) => t.type === type)!, id);
    const RUN_DOC: EffectDoc = {
      pipeline: {
        stages: [typed('source', 'src'), typed('blur', 'blur'), typed('out', 'out')],
        wires: [
          { id: 'w1', from: { stage: 'src', port: 'out' }, to: { stage: 'blur', port: 'in' } },
          { id: 'w2', from: { stage: 'blur', port: 'out' }, to: { stage: 'out', port: 'in' } },
        ],
        types: { number: { control: true } },
      },
      places: { src: { x: 0, y: 0 }, blur: { x: 200, y: 0 }, out: { x: 400, y: 0 } },
    };
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

    /** The canvas pixel, RGBA, under the world point `fx`, `fy` of the way across spec `id`'s box and
     *  `dx` further right, in the view the editor opened on. Read straight after a frame, before the
     *  buffer is cleared. */
    async function pixelOn(id: string, fx: number, fy: number, dx = 0): Promise<number[]> {
      const canvas = document.querySelector<HTMLCanvasElement>('.wc-host canvas')!;
      const r = canvas.getBoundingClientRect();
      const opened = editorScene(RUN_DOC);
      const boxes = diagramScene(opened.data, { ...opened.scene, composition: IDENTITY_POSE_COMPOSITION }).filter((s) => isBodyOrRegion(s) || diagramGroupOf(s) !== null).map((s) => s.pose as RectPose);
      const left = Math.min(...boxes.map((b) => b.x));
      const top = Math.min(...boxes.map((b) => b.y));
      const bounds = {
        x: left, y: top, width: Math.max(...boxes.map((b) => b.x + b.width)) - left, height: Math.max(...boxes.map((b) => b.y + b.height)) - top,
      };
      const t = viewToTransform(fitViewToBounds(bounds, { width: r.width, height: r.height }, { x: 0, y: 0, scale: { x: 1, y: 1 } }, {
        maxScale: 1, minScale: EFFECT_MIN_SCALE, anchor: 'start',
      }));
      const drawn = editorScene(RUN_DOC, 'nodeGraph', { showValues: false, showPreviews: true });
      const box = diagramScene(drawn.data, { ...drawn.scene, composition: IDENTITY_POSE_COMPOSITION }).find((s) => s.id === id)!.pose as RectPose;
      const dpr = canvas.width / r.width;
      const x = Math.round((t.panX + (box.x + box.width * fx + dx) * t.zoom.x) * dpr);
      const y = Math.round((t.panY + (box.y + box.height * fy) * t.zoom.y) * dpr);
      await frame();
      const gl = canvasGl(canvas);
      const px = new Uint8Array(4);
      gl.readPixels(x, canvas.height - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return [...px];
    }
    /** Whether a preview slot shows the test card's middle bar, which is green: blur's by default. */
    const greenPreview = async (slot = `blur/${previewRowId('out')}`) => {
      const [r, g] = await pixelOn(slot, 0.5, 0.5);
      return g! > 120 && r! < 80;
    };
    /** Whether `id`'s left edge is drawn in the outline's amber rather than the stage's blue-gray. At an
     *  opening scale below 1 the outline is antialiased into the fill, so its hue is tested, not its exact color. */
    const outlined = async (id: string) => {
      const [r, g, b] = await pixelOn(id, 0, 0.5, 0.5);
      const [ar, ag, ab] = [1, 3, 5].map((i) => parseInt(AT_COLOR.slice(i, i + 2), 16));
      return r! > ar! * 0.6 && g! > ag! * 0.6 && b! < ab! * 1.5 && r! > b! * 2;
    };
    const runItem = async (name: RegExp) => {
      await userEvent.click(page.getByRole('menubar').getByRole('menuitem', { name: 'Run' }));
      const item = [...document.querySelectorAll<HTMLElement>('[role="menu"] [role^="menuitem"]')].find((el) => name.test(el.textContent ?? ''))!;
      return item;
    };

    beforeEach(async () => {
      localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(RUN_DOC));
      await mountChartApp();
      await choose('Mode', /^Pipeline/);
      await choose('View', /^Show Previews/);
    });

    it('runs the pipeline once over the test card, filling each preview, Out\'s with the finished image', async () => {
      expect(await greenPreview()).toBe(false);
      await choose('Run', /^Run/);
      await expect.poll(() => greenPreview()).toBe(true);
      expect(await greenPreview(`out/${previewRowId('in')}`)).toBe(true);
    });

    it('steps a stage at a time, outlining the stage it is on', async () => {
      await choose('Run', /^Step/);
      await expect.poll(() => outlined('src')).toBe(true);
      expect(await outlined('blur')).toBe(false);
      expect(await greenPreview()).toBe(false);
      await choose('Run', /^Step/);
      await expect.poll(() => outlined('blur')).toBe(true);
      expect(await outlined('src')).toBe(false);
      expect(await greenPreview()).toBe(true);
    });

    it('plays until paused, and Reset clears the run', async () => {
      expect((await runItem(/^Pause/)).getAttribute('aria-disabled')).toBe('true');
      await userEvent.keyboard('{Escape}');
      await choose('Run', /^Play/);
      await expect.poll(() => greenPreview()).toBe(true);
      expect((await runItem(/^Play/)).getAttribute('aria-disabled')).toBe('true');
      await userEvent.keyboard('{Escape}');
      await choose('Run', /^Pause/);
      expect((await runItem(/^Play/)).getAttribute('aria-disabled')).not.toBe('true');
      await userEvent.keyboard('{Escape}');
      await choose('Run', /^Reset/);
      await expect.poll(() => greenPreview()).toBe(false);
    });
  });
});
