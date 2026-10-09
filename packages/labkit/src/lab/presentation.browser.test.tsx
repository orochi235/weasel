import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../styles.less';
import './presentation.browser.test.less';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import type { Instrument } from '../instrument/types';
import { Lab } from './Lab';
import { LabContext, type LabContextValue } from './LabContext';
import { type Presentation, usePresentation } from './presentation';

// What presenting hides and what it fills is layout, and what it hands the page
// is a computed color-scheme: a browser's to answer.

afterEach(cleanup);

const Painted: Instrument = {
  name: 'Painted',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  canvas: {
    layers: [
      {
        id: 'fill',
        draw: (ctx) => {
          ctx.fillStyle = 'rgb(0, 128, 255)';
          ctx.fillRect(-1e5, -1e5, 2e5, 2e5);
        },
      },
    ],
  },
  render: () => null,
};

let presentation: Presentation | null = null;
let lab: LabContextValue | null = null;
function Capture() {
  presentation = usePresentation();
  return (
    <LabContext.Consumer>
      {(value) => {
        lab = value;
        return null;
      }}
    </LabContext.Consumer>
  );
}

function mount(present: boolean) {
  return render(
    <div className="lk-present-frame">
      <Lab instruments={[Painted]} defaultInstrument="Painted" present={present}>
        <Capture />
      </Lab>
    </div>,
  );
}

const box = (el: Element | null) => el?.getBoundingClientRect();
const hasBox = (el: Element | null) => !!el && el.getClientRects().length > 0;

test('a presented trial fills the lab and nothing else has a box', async () => {
  const { container } = mount(true);
  await expect
    .poll(() => box(container.querySelector('.lk-trial__stage'))?.width)
    .toBeGreaterThan(0);
  const labEl = container.querySelector('.lk-lab');
  const trial = container.querySelector('.lk-trial[data-lk-presented]');
  const stage = container.querySelector('.lk-trial__stage');

  expect(box(trial)).toEqual(box(container.querySelector('.lk-lab__body')));
  expect(box(stage)).toEqual(box(trial));
  expect(box(labEl)?.height).toBe(480);
  expect(box(stage)?.height).toBe(480);
  expect(
    getComputedStyle(container.querySelector('.lk-canvas-stack') as Element).backgroundColor,
  ).toBe('rgba(0, 0, 0, 0)');
  for (const hidden of ['.lk-viewport-controls', '.lk-shell-header', '.lk-trial__titlebar']) {
    expect(container.querySelector(hidden), hidden).not.toBeNull();
  }
  for (const hidden of [
    '.lk-viewport-controls',
    '.lk-shell-header',
    '.lk-trial__titlebar',
    '.lk-trial__toolbar',
    '.lk-trial__status',
    '.lk-trial__sidebar',
  ]) {
    expect(hasBox(container.querySelector(hidden)), hidden).toBe(false);
  }
});

test('a presenting lab hands the page back its own color-scheme and a clear ground', () => {
  mount(true);
  const root = getComputedStyle(document.documentElement);
  expect(root.colorScheme).toBe('normal');
  expect(root.backgroundColor).toBe('rgba(0, 0, 0, 0)');
  expect(getComputedStyle(document.body).backgroundColor).toBe('rgba(0, 0, 0, 0)');
  cleanup();
  expect(getComputedStyle(document.documentElement).colorScheme).not.toBe('normal');
});

test('entering and leaving keeps every trial’s canvas element', async () => {
  const { container } = mount(false);
  await act(async () => lab?.addTrial('Painted'));
  const canvases = () => [...container.querySelectorAll('.lk-canvas-stack__canvas')];
  await expect.poll(() => canvases().length).toBe(2);
  const before = canvases();

  await act(async () => presentation?.enter());
  const presented = container.querySelector('.lk-trial[data-lk-presented]');
  expect(box(presented)).toEqual(box(container.querySelector('.lk-lab__body')));
  expect(container.querySelectorAll('.lk-trial').length).toBe(2);
  expect(canvases().filter(hasBox)).toHaveLength(1);

  await act(async () => presentation?.exit());
  expect(canvases()).toEqual(before);
  expect(canvases().filter(hasBox)).toHaveLength(2);
});

const Timed: Instrument = { ...Painted, name: 'Timed', clock: { duration: 1000 } };

function mountTimed(frame: string, transport?: { minWidth: number }) {
  return render(
    <div className={frame}>
      <Lab
        instruments={[Timed]}
        defaultInstrument="Timed"
        present
        {...(transport ? { transport } : {})}
      >
        <Capture />
      </Lab>
    </div>,
  );
}

test('play controls sit along the bottom of a presented trial, inside it', async () => {
  const { container, findByRole } = mountTimed('lk-present-frame');
  const play = await findByRole('button', { name: 'Play' });
  const controls = play.closest('.lk-presented-transport');
  const trial = container.querySelector('[data-lk-presented]');
  await expect.poll(() => box(controls)?.width ?? 0).toBeGreaterThan(0);
  const c = box(controls) as DOMRect;
  const t = box(trial) as DOMRect;
  expect(c.bottom).toBeLessThanOrEqual(t.bottom);
  expect(c.bottom).toBeGreaterThan(t.bottom - 40);
  expect(c.left).toBeGreaterThanOrEqual(t.left);
  expect(c.right).toBeLessThanOrEqual(t.right);
  // Laid over the canvas, not taking room from it.
  expect(box(container.querySelector('.lk-canvas-stack'))?.height).toBe(t.height);
});

test('play controls are hidden in a presented box too narrow for them', async () => {
  const { container, findByRole } = mountTimed('lk-present-frame lk-present-frame--narrow');
  const play = await findByRole('button', { name: 'Play', hidden: true });
  await expect.poll(() => box(container.querySelector('[data-lk-presented]'))?.width).toBe(360);
  expect(hasBox(play)).toBe(false);
});

test('a lab says how narrow is too narrow for its play controls', async () => {
  const { container, findByRole } = mountTimed('lk-present-frame lk-present-frame--narrow', {
    minWidth: 300,
  });
  const play = await findByRole('button', { name: 'Play' });
  await expect.poll(() => box(container.querySelector('[data-lk-presented]'))?.width).toBe(360);
  await expect.poll(() => hasBox(play)).toBe(true);
});

const Centered: Instrument = {
  ...Painted,
  name: 'Centered',
  canvas: {
    layers: Painted.canvas?.layers ?? [],
    initialView: (size) => ({ zoom: 1, pan: { x: size.width / 2, y: size.height / 2 } }),
  },
};

test('entering refits the view to the presented box, and leaving gives the tile its own back', async () => {
  const { container } = render(
    <div className="lk-present-frame">
      <Lab instruments={[Centered]} defaultInstrument="Centered">
        <Capture />
      </Lab>
    </div>,
  );
  await act(async () => lab?.addTrial('Centered'));
  const focused = () => lab?.trials.find((t) => t.id === lab?.focusedTrialId);
  await expect.poll(() => focused()?.view ?? null).not.toBeNull();
  const tileView = focused()?.view;

  await act(async () => presentation?.enter());
  const presentedBox = box(container.querySelector('[data-lk-presented] .lk-canvas-stack'));
  expect(presentedBox?.width).toBeGreaterThan(0);
  expect(focused()?.view).toEqual({
    zoom: 1,
    pan: { x: (presentedBox?.width ?? 0) / 2, y: (presentedBox?.height ?? 0) / 2 },
  });

  await act(async () => presentation?.exit());
  expect(focused()?.view).toEqual(tileView);
});
