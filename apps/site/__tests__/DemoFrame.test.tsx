import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { DemoFrame } from '../DemoFrame';
import { DemoStage, DemoStageGroup } from '../demos/DemoStage';

const stagesOf = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('.ckd-stage')];
const cornerOf = (el: HTMLElement) => el.querySelector<HTMLElement>('.ckd-demo-resize[data-axis="both"]')!;
const corner = (container: HTMLElement) => cornerOf(container);
const dw = (el: Element) => (el as HTMLElement).style.getPropertyValue('--demo-stage-dw');
const dh = (el: Element) => (el as HTMLElement).style.getPropertyValue('--demo-stage-dh');
const stage = (container: HTMLElement) => stagesOf(container)[0];

function drag(handle: HTMLElement, dx: number, dy: number): void {
  fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 100 + dx, clientY: 100 + dy });
  fireEvent.pointerUp(handle, { pointerId: 1, clientX: 100 + dx, clientY: 100 + dy });
}

describe('DemoFrame', () => {
  it('offers no handle to a demo with no stage in it', () => {
    const { container } = render(<DemoFrame><p>a form</p></DemoFrame>);
    expect(container.querySelector('.ckd-demo-resize')).toBeNull();
  });

  it('offers no handle to a stage outside a frame', () => {
    const { container } = render(<DemoStage width={400} height={300}><i /></DemoStage>);
    expect(container.querySelector('.ckd-demo-resize')).toBeNull();
  });

  it('offers a corner and two edge handles once a stage mounts inside', () => {
    const { container } = render(<DemoFrame><DemoStage width={400} height={300}><i /></DemoStage></DemoFrame>);
    const axes = [...container.querySelectorAll<HTMLElement>('.ckd-demo-resize')].map((h) => h.dataset.axis);
    expect(axes.sort()).toEqual(['both', 'x', 'y']);
  });

  it('resizes each stage on its own, and resets only the one double-clicked', () => {
    const { container } = render(
      <DemoFrame>
        <DemoStage width={400} height={300}><i /></DemoStage>
        <DemoStage width={200} height={150}><i /></DemoStage>
      </DemoFrame>,
    );
    const [a, b] = stagesOf(container);
    drag(cornerOf(b), 30, 20);
    expect([dw(b), dh(b)]).toEqual(['30px', '20px']);
    expect([dw(a), dh(a)]).toEqual(['', '']);
    drag(cornerOf(a), 10, 0);
    expect(dw(a)).toBe('10px');
    expect(dw(b)).toBe('30px');
    fireEvent.doubleClick(cornerOf(a));
    expect(dw(a)).toBe('');
    expect(dw(b)).toBe('30px');
  });

  it('resizes the stages of a group as one, from any of them, and resets them together', () => {
    const { container } = render(
      <DemoFrame>
        <DemoStage width={100} height={100}><i /></DemoStage>
        <DemoStageGroup>
          <DemoStage width={400} height={300}><i /></DemoStage>
          <DemoStage width={200} height={150}><i /></DemoStage>
        </DemoStageGroup>
      </DemoFrame>,
    );
    const [solo, a, b] = stagesOf(container);
    const group = container.querySelector<HTMLElement>('.ckd-stage-group')!;
    drag(cornerOf(b), 30, 20);
    expect([dw(group), dh(group)]).toEqual(['30px', '20px']);
    drag(cornerOf(a), 10, 0);
    expect(dw(group)).toBe('40px');
    expect([dw(a), dw(b), dw(solo)]).toEqual(['', '', '']);
    fireEvent.doubleClick(cornerOf(b));
    expect([dw(group), dh(group)]).toEqual(['', '']);
  });

  it('gives a stage its natural size until a handle is dragged', () => {
    const { container } = render(<DemoFrame><DemoStage width={400} height={300}><i /></DemoStage></DemoFrame>);
    expect(stage(container).style.getPropertyValue('--demo-stage-w')).toBe('400px');
    expect(stage(container).style.getPropertyValue('--demo-stage-h')).toBe('300px');
    expect(dw(stage(container))).toBe('');
  });

  it('grows the stage by what the corner is dragged, and a double-click puts it back', () => {
    const { container } = render(<DemoFrame><DemoStage width={400} height={300}><i /></DemoStage></DemoFrame>);
    drag(corner(container), 120, -40);
    expect([dw(stage(container)), dh(stage(container))]).toEqual(['120px', '-40px']);
    drag(corner(container), 10, 10);
    expect(dw(stage(container))).toBe('130px');
    fireEvent.doubleClick(corner(container));
    expect([dw(stage(container)), dh(stage(container))]).toEqual(['', '']);
  });

  it('moves only its own axis from an edge', () => {
    const { container } = render(<DemoFrame><DemoStage width={400} height={300}><i /></DemoStage></DemoFrame>);
    drag(container.querySelector<HTMLElement>('.ckd-demo-resize[data-axis="x"]')!, 50, 70);
    expect([dw(stage(container)), dh(stage(container))]).toEqual(['50px', '0px']);
  });

  it('resizes from the keyboard', () => {
    const { container } = render(<DemoFrame><DemoStage width={400} height={300}><i /></DemoStage></DemoFrame>);
    fireEvent.keyDown(corner(container), { key: 'ArrowRight' });
    fireEvent.keyDown(corner(container), { key: 'ArrowUp' });
    expect([dw(stage(container)), dh(stage(container))]).toEqual(['16px', '-16px']);
  });
});
