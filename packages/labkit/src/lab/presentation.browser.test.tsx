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
  await expect.poll(() => box(container.querySelector('.lk-trial__stage'))?.width).toBeGreaterThan(0);
  const labEl = container.querySelector('.lk-lab');
  const trial = container.querySelector('.lk-trial[data-lk-presented]');
  const stage = container.querySelector('.lk-trial__stage');

  expect(box(trial)).toEqual(box(container.querySelector('.lk-lab__body')));
  expect(box(stage)).toEqual(box(trial));
  expect(box(labEl)?.height).toBe(480);
  expect(box(stage)?.height).toBe(480);
  for (const hidden of ['.lk-shell-header', '.lk-trial__titlebar', '.lk-trial__toolbar', '.lk-trial__status', '.lk-trial__sidebar']) {
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
