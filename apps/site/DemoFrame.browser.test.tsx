import './canvas-kit-demo.css';
import { afterEach, expect, test } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DemoFrame } from './DemoFrame';
import { PanZoomDemo } from './demos/PanZoomDemo';
import { DemoStage, DemoStageGroup } from './demos/DemoStage';

// A stage holds a filling canvas at the demo's natural size, which is what the
// visual baselines capture, and a drag on the stage's corner grows the canvas.

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const settle = async () => { for (let i = 0; i < 4; i++) await frame(); };

const fire = (el: Element, type: string, x: number, y: number) =>
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y,
  }));

test('a staged demo opens at its natural size and follows a drag of the corner', async () => {
  host = document.createElement('div');
  host.className = 'ckd-canvas-wrap';
  document.body.append(host);
  await act(async () => {
    root = createRoot(host!);
    root.render(<DemoFrame><PanZoomDemo /></DemoFrame>);
  });
  await settle();
  const canvas = host.querySelector('canvas')!;
  const dpr = window.devicePixelRatio;
  expect([canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height]).toEqual([400, 300]);
  expect([canvas.width, canvas.height]).toEqual([400 * dpr, 300 * dpr]);

  const corner = host.querySelector('.ckd-demo-resize[data-axis="both"]')!;
  const { left, top } = corner.getBoundingClientRect();
  await act(async () => {
    fire(corner, 'pointerdown', left + 5, top + 5);
    fire(corner, 'pointermove', left + 105, top + 45);
    fire(corner, 'pointerup', left + 105, top + 45);
  });
  await settle();
  expect([canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height]).toEqual([500, 340]);
  expect([canvas.width, canvas.height]).toEqual([500 * dpr, 340 * dpr]);

  await act(async () => { corner.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
  await settle();
  expect([canvas.width, canvas.height]).toEqual([400 * dpr, 300 * dpr]);
});

test('the corner handle sits on the stage, not on a wider row beside it, and grows the stage', async () => {
  host = document.createElement('div');
  host.className = 'ckd-canvas-wrap';
  document.body.append(host);
  await act(async () => {
    root = createRoot(host!);
    root.render(
      <DemoFrame>
        <div className="fixture-demo">
          <div className="fixture-row">
            <DemoStage width={400} height={300}><canvas /></DemoStage>
            <div className="fixture-side">side</div>
          </div>
          <div className="fixture-hint">a hint row much wider than the canvas</div>
        </div>
      </DemoFrame>,
    );
  });
  const style = document.createElement('style');
  style.textContent = `.fixture-row { display: flex; gap: 10px; }
    .fixture-side { width: 50px; height: 20px; }
    .fixture-hint { width: 860px; }`;
  host.append(style);
  await settle();

  const stage = host.querySelector<HTMLElement>('.ckd-stage')!;
  const side = host.querySelector<HTMLElement>('.fixture-side')!;
  const s = stage.getBoundingClientRect();
  expect([s.width, s.height]).toEqual([400, 300]);
  expect(side.getBoundingClientRect().left).toBe(s.right + 10);

  const corner = host.querySelector<HTMLElement>('.ckd-demo-resize[data-axis="both"]')!;
  const c = corner.getBoundingClientRect();
  expect(c.left).toBeLessThanOrEqual(s.right + 2);
  expect(c.right).toBeGreaterThanOrEqual(s.right - 2);
  expect(c.top).toBeLessThanOrEqual(s.bottom + 2);
  expect(c.bottom).toBeGreaterThanOrEqual(s.bottom - 2);
  const bottom = host.querySelector<HTMLElement>('.ckd-demo-resize[data-axis="y"]')!.getBoundingClientRect();
  expect(Math.abs(bottom.width - s.width)).toBeLessThanOrEqual(2);

  await act(async () => {
    fire(corner, 'pointerdown', c.left + 5, c.top + 5);
    fire(corner, 'pointermove', c.left + 65, c.top + 25);
    fire(corner, 'pointerup', c.left + 65, c.top + 25);
  });
  await settle();
  const grown = stage.getBoundingClientRect();
  expect([grown.width, grown.height]).toEqual([460, 320]);
});

async function mount(node: ReactNode): Promise<HTMLElement> {
  host = document.createElement('div');
  host.className = 'ckd-canvas-wrap';
  document.body.append(host);
  await act(async () => {
    root = createRoot(host!);
    root.render(<DemoFrame>{node}</DemoFrame>);
  });
  await settle();
  return host;
}

async function dragCorner(stage: Element, dx: number, dy: number): Promise<void> {
  const corner = stage.querySelector('.ckd-demo-resize[data-axis="both"]')!;
  const { left, top } = corner.getBoundingClientRect();
  await act(async () => {
    fire(corner, 'pointerdown', left + 5, top + 5);
    fire(corner, 'pointermove', left + 5 + dx, top + 5 + dy);
    fire(corner, 'pointerup', left + 5 + dx, top + 5 + dy);
  });
  await settle();
}

const sizes = (el: HTMLElement) => [...el.querySelectorAll('.ckd-stage')]
  .map((s) => [s.getBoundingClientRect().width, s.getBoundingClientRect().height]);

test('a drag on one stage resizes that stage alone', async () => {
  const el = await mount(<>
    <DemoStage width={400} height={300}><canvas /></DemoStage>
    <DemoStage width={200} height={150}><canvas /></DemoStage>
  </>);
  await dragCorner(el.querySelectorAll('.ckd-stage')[1], 40, 30);
  expect(sizes(el)).toEqual([[400, 300], [240, 180]]);
});

test('a drag on any stage of a group resizes every stage in it, down to 120px for the smallest', async () => {
  const el = await mount(<>
    <DemoStage width={300} height={300}><canvas /></DemoStage>
    <DemoStageGroup>
      <DemoStage width={400} height={300}><canvas /></DemoStage>
      <DemoStage width={200} height={150}><canvas /></DemoStage>
    </DemoStageGroup>
  </>);
  await dragCorner(el.querySelectorAll('.ckd-stage')[1], 40, 30);
  expect(sizes(el)).toEqual([[300, 300], [440, 330], [240, 180]]);
  await dragCorner(el.querySelectorAll('.ckd-stage')[2], -400, 0);
  expect(sizes(el)).toEqual([[300, 300], [320, 330], [120, 180]]);
});
