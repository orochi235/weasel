/**
 * Containers and pools in a real browser: drawn from the Shapes panel, filled
 * by dragging shapes in, moved with what they hold, lanes reordered by their
 * headers and resized by their boundaries, and a pool saved and reloaded.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { registerCanvasFont } from '@weasel-js/font';
import '@weasel-js/theme/tokens.css';
import { CHART_PAGE } from './chartDocument';
import { CHART_SCENE_KEY } from './chartPersistence';
import { chartPrefs } from './prefs';
import { STENCIL_MIME } from './stencilDrop';
import { mountChartApp, unmountChartApp } from './testing/mountChartApp';

registerCanvasFont('sans-serif');

beforeEach(async () => {
  await page.viewport(1280, 800);
  localStorage.clear();
});

afterEach(() => {
  unmountChartApp();
  localStorage.clear();
});

interface Saved {
  id: string;
  kind: string;
  parent?: string | null;
  layoutKey?: string;
  pose: { x: number; y: number; width: number; height: number };
  data: { diagram?: { outline?: string; container?: { role: string } } };
}

const saved = (): Saved[] => {
  const raw = localStorage.getItem(CHART_SCENE_KEY);
  return raw ? (JSON.parse(raw) as { nodes: Saved[] }).nodes : [];
};
const role = (r: string) => saved().filter((n) => n.data.diagram?.container?.role === r);
/** Stencil bodies: containers with an outline and no container role. */
const bodies = () => saved().filter((n) => n.kind === 'container' && n.data.diagram?.outline && !n.data.diagram.container);
const byId = (id: string) => saved().find((n) => n.id === id)!;
const lanesInOrder = () => role('lane').sort((a, b) => a.pose.y - b.pose.y);

/** Client point of a world point: the page is fitted to the workspace with 24px of padding. */
function at(host: HTMLElement, x: number, y: number): { x: number; y: number } {
  const box = host.getBoundingClientRect();
  const scale = Math.min((box.width - 48) / CHART_PAGE.width, (box.height - 48) / CHART_PAGE.height);
  return {
    x: box.left + box.width / 2 + (x - CHART_PAGE.width / 2) * scale,
    y: box.top + box.height / 2 + (y - CHART_PAGE.height / 2) * scale,
  };
}

function pointer(el: Element, type: string, p: { x: number; y: number }, buttons = 1): void {
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : buttons, clientX: p.x, clientY: p.y,
  }));
}

const frame = () => new Promise((r) => requestAnimationFrame(r));

async function drag(el: Element, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  pointer(el, 'pointermove', from, 0);
  pointer(el, 'pointerdown', from);
  for (let i = 1; i <= 8; i++) {
    pointer(el, 'pointermove', { x: from.x + ((to.x - from.x) * i) / 8, y: from.y + ((to.y - from.y) * i) / 8 });
    await frame();
  }
  pointer(el, 'pointerup', to);
  await frame();
}

async function click(el: Element, p: { x: number; y: number }): Promise<void> {
  pointer(el, 'pointermove', p, 0);
  await frame();
  pointer(el, 'pointerdown', p);
  pointer(el, 'pointerup', p);
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: p.x, clientY: p.y }));
  await frame();
}

const shapes = (name: string) => userEvent.click(page.getByRole('toolbar', { name: 'Shapes' }).getByRole('button', { name, exact: true }));
const useSelect = () => userEvent.click(page.getByRole('toolbar').getByRole('button', { name: /^Select/ }));

describe('WeaselChart containers', () => {
  it('takes a shape dragged in, moves it along, and lets it go when dragged out', async () => {
    const { host, canvas } = await mountChartApp();
    await shapes('Container');
    await drag(canvas, at(host, 100, 100), at(host, 400, 300));
    await expect.poll(() => role('container').length).toBe(1);
    const box = role('container')[0]!.id;
    await shapes('Process');
    await drag(canvas, at(host, 500, 100), at(host, 620, 160));
    await expect.poll(() => bodies().length).toBe(1);
    const body = bodies()[0]!.id;

    await useSelect();
    await drag(canvas, at(host, 560, 130), at(host, 250, 220));
    await expect.poll(() => byId(body).parent).toBe(box);

    const before = byId(body).pose;
    await drag(canvas, at(host, 120, 112), at(host, 170, 152));
    await expect.poll(() => byId(box).pose.x).toBeCloseTo(150, 0);
    expect(byId(body).pose.x).toBeCloseTo(before.x + 50, 0);
    expect(byId(body).pose.y).toBeCloseTo(before.y + 40, 0);

    await drag(canvas, at(host, before.x + 110, before.y + 70), at(host, 800, 600));
    await expect.poll(() => byId(body).parent ?? null).toBeNull();
  });

  async function buildPool() {
    const mounted = await mountChartApp();
    await shapes('Pool (rows)');
    await drag(mounted.canvas, at(mounted.host, 100, 100), at(mounted.host, 580, 340));
    await expect.poll(() => role('lane').length).toBe(2);
    const [first, second] = lanesInOrder().map((l) => l.id);
    return { ...mounted, pool: role('pool')[0]!.id, first: first!, second: second! };
  }

  it('builds a pool, fills a lane, and reorders lanes by their headers', async () => {
    const { host, canvas, second, first } = await buildPool();
    expect(byId(second).pose.x).toBeCloseTo(132, 0);
    expect(byId(second).pose.y).toBeCloseTo(220, 0);
    expect(byId(second).pose.height).toBeCloseTo(120, 0);

    await shapes('Process');
    await drag(canvas, at(host, 700, 100), at(host, 820, 160));
    await expect.poll(() => bodies().length).toBe(1);
    const body = bodies()[0]!.id;
    await useSelect();
    await drag(canvas, at(host, 760, 130), at(host, 350, 280));
    await expect.poll(() => byId(body).parent).toBe(second);

    // The second lane's header is the strip at its left; drag it above the first.
    await drag(canvas, at(host, 146, 300), at(host, 146, 140));
    await expect.poll(() => lanesInOrder().map((l) => l.id)).toEqual([second, first]);
    expect(byId(body).pose.y).toBeLessThan(220);
  });

  it('resizes a lane at its boundary, adds one, and keeps the pool through a reload', async () => {
    const { host, canvas, pool, first } = await buildPool();
    // The boundary after the top lane, at y = 220, dragged down 40.
    await drag(canvas, at(host, 400, 220), at(host, 400, 260));
    await expect.poll(() => byId(first).pose.height).toBeCloseTo(160, 0);
    expect(byId(pool).pose.height).toBeCloseTo(280, 0);

    // The add-lane button sits 14 screen pixels below the middle of the pool's bottom edge.
    const bottom = at(host, 340, 380);
    await click(canvas, { x: bottom.x, y: bottom.y + 14 });
    await expect.poll(() => role('lane').length).toBe(3);
    expect(byId(pool).pose.height).toBeCloseTo(400, 0);
    expect(byId(pool).layoutKey).toBe('diagram:pool-rows');

    unmountChartApp();
    const again = await mountChartApp();
    await expect.poll(() => role('lane').length).toBe(3);
    await shapes('Process');
    await drag(again.canvas, at(again.host, 700, 400), at(again.host, 820, 460));
    await expect.poll(() => bodies().length).toBe(1);
    const late = bodies()[0]!.id;
    await useSelect();
    await drag(again.canvas, at(again.host, 760, 430), at(again.host, 350, 440));
    await expect.poll(() => byId(late).parent).toBe(lanesInOrder()[2]!.id);
  });

  it('puts a stencil dropped inside a container into it, on the grid under snap to grid', async () => {
    chartPrefs().set('view.snapToGrid', true);
    // The container's centerlines would otherwise out-rank the grid.
    chartPrefs().set('view.alignmentSnap', false);
    const { host, canvas } = await mountChartApp();
    await shapes('Container');
    await drag(canvas, at(host, 100, 100), at(host, 500, 400));
    await expect.poll(() => role('container').length).toBe(1);
    const box = role('container')[0]!.id;
    const dt = new DataTransfer();
    dt.setData(STENCIL_MIME, 'decision');
    const p = at(host, 300, 250);
    for (const type of ['dragenter', 'dragover', 'drop']) {
      canvas.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: p.x, clientY: p.y }));
    }
    await expect.poll(() => bodies().length).toBe(1);
    const body = bodies()[0]!;
    expect(body.parent).toBe(box);
    expect([Math.round(body.pose.x) % 12, Math.round(body.pose.y) % 12]).toEqual([0, 0]);
  });
});
