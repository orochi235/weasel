import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { DemoFrame } from '../DemoFrame';
import { DemoStage } from '../demos/DemoStage';

const frameOf = (container: HTMLElement) => container.querySelector<HTMLElement>('.ckd-demo-frame')!;
const corner = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('.ckd-demo-resize[data-axis="both"]')!;

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

  it('offers a corner and two edge handles once a stage mounts inside', () => {
    const { container } = render(<DemoFrame><DemoStage width={400} height={300}><i /></DemoStage></DemoFrame>);
    const axes = [...container.querySelectorAll<HTMLElement>('.ckd-demo-resize')].map((h) => h.dataset.axis);
    expect(axes.sort()).toEqual(['both', 'x', 'y']);
  });

  it('puts each stage\'s handles on that stage, all driving one delta', () => {
    const { container } = render(
      <DemoFrame>
        <DemoStage width={400} height={300}><i /></DemoStage>
        <DemoStage width={200} height={150}><i /></DemoStage>
      </DemoFrame>,
    );
    const stages = [...container.querySelectorAll<HTMLElement>('.ckd-stage')];
    const corners = stages.map((st) => st.querySelector<HTMLElement>('.ckd-demo-resize[data-axis="both"]')!);
    expect(corners.every(Boolean)).toBe(true);
    drag(corners[1], 30, 20);
    expect(frameOf(container).style.getPropertyValue('--demo-stage-dw')).toBe('30px');
    drag(corners[0], 10, 0);
    expect(frameOf(container).style.getPropertyValue('--demo-stage-dw')).toBe('40px');
  });

  it('gives a stage its natural size until a handle is dragged', () => {
    const { container } = render(<DemoFrame><DemoStage width={400} height={300}><i /></DemoStage></DemoFrame>);
    const stage = container.querySelector<HTMLElement>('.ckd-stage')!;
    expect(stage.style.getPropertyValue('--demo-stage-w')).toBe('400px');
    expect(stage.style.getPropertyValue('--demo-stage-h')).toBe('300px');
    expect(frameOf(container).style.getPropertyValue('--demo-stage-dw')).toBe('');
  });

  it('grows the stage by what the corner is dragged, and a double-click puts it back', () => {
    const { container } = render(<DemoFrame><DemoStage width={400} height={300}><i /></DemoStage></DemoFrame>);
    drag(corner(container), 120, -40);
    expect(frameOf(container).style.getPropertyValue('--demo-stage-dw')).toBe('120px');
    expect(frameOf(container).style.getPropertyValue('--demo-stage-dh')).toBe('-40px');
    drag(corner(container), 10, 10);
    expect(frameOf(container).style.getPropertyValue('--demo-stage-dw')).toBe('130px');
    fireEvent.doubleClick(corner(container));
    expect(frameOf(container).style.getPropertyValue('--demo-stage-dw')).toBe('');
    expect(frameOf(container).style.getPropertyValue('--demo-stage-dh')).toBe('');
  });

  it('moves only its own axis from an edge', () => {
    const { container } = render(<DemoFrame><DemoStage width={400} height={300}><i /></DemoStage></DemoFrame>);
    drag(container.querySelector<HTMLElement>('.ckd-demo-resize[data-axis="x"]')!, 50, 70);
    expect(frameOf(container).style.getPropertyValue('--demo-stage-dw')).toBe('50px');
    expect(frameOf(container).style.getPropertyValue('--demo-stage-dh')).toBe('0px');
  });

  it('resizes from the keyboard', () => {
    const { container } = render(<DemoFrame><DemoStage width={400} height={300}><i /></DemoStage></DemoFrame>);
    fireEvent.keyDown(corner(container), { key: 'ArrowRight' });
    fireEvent.keyDown(corner(container), { key: 'ArrowUp' });
    expect(frameOf(container).style.getPropertyValue('--demo-stage-dw')).toBe('16px');
    expect(frameOf(container).style.getPropertyValue('--demo-stage-dh')).toBe('-16px');
  });
});
