import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { meshFromStops, seedMeshPatch, type MeshGradientFill } from '@weasel-js/core/mesh';
import { handleHalf } from '../../handles';
import { MeshHandles } from './MeshHandles';

/** A 2× zoom panned by (10, 20), so mesh space and overlay pixels differ. */
const toScreen = (p: { x: number; y: number }) => ({ x: p.x * 2 + 10, y: p.y * 2 + 20 });
const toLocal = (p: { x: number; y: number }) => ({ x: (p.x - 10) / 2, y: (p.y - 20) / 2 });

beforeAll(() => {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { x: 0, y: 0, top: 0, left: 0, right: 400, bottom: 300, width: 400, height: 300, toJSON: () => {} } as DOMRect;
  };
});

/** The seed patch scaled onto a 100-unit square, in a local frame. */
function local(mesh: MeshGradientFill, size = 100): MeshGradientFill {
  return {
    ...mesh,
    units: 'local',
    patches: mesh.patches.map((p) => ({ ...p, points: p.points.map((q) => ({ x: q.x * size, y: q.y * size })) })),
  };
}

function drag(label: string, to: { x: number; y: number }): void {
  const handle = screen.getByLabelText(label);
  fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientX: to.x, clientY: to.y, pointerId: 1 });
  fireEvent.pointerUp(handle, { clientX: to.x, clientY: to.y, pointerId: 1 });
}

function mount(value: MeshGradientFill, onChange = vi.fn(), onInput = vi.fn()) {
  render(
    <MeshHandles value={value} toScreen={toScreen} toLocal={toLocal}
      onInput={onInput} onChange={onChange} width={400} height={300} />,
  );
  return { onChange, onInput };
}

describe('MeshHandles', () => {
  it('puts a handle on every corner and edge control, through toScreen', () => {
    mount(local(seedMeshPatch('#3366ccff')));
    expect(screen.getAllByRole('button')).toHaveLength(12);
    expect(screen.getByLabelText('Patch 1 corner 3')).toHaveAttribute('cx', '210');
    expect(screen.getByLabelText('Patch 1 corner 3')).toHaveAttribute('cy', '220');
  });

  it('sizes corners and controls from the handle-size tokens', () => {
    mount(local(seedMeshPatch('#3366ccff')));
    expect(Number(screen.getByLabelText('Patch 1 corner 1').getAttribute('r')))
      .toBe(handleHalf('--wzl-handle-size-lg'));
    expect(Number(screen.getByLabelText('Patch 1 edge 1 control 1').getAttribute('r')))
      .toBe(handleHalf('--wzl-handle-size'));
  });

  it('draws one handle for a corner two patches share', () => {
    const bands = local(meshFromStops([
      { offset: 0, color: '#000' }, { offset: 0.5, color: '#888' }, { offset: 1, color: '#fff' },
    ]));
    mount(bands);
    // Two bands: six corners and fourteen controls, not eight and sixteen.
    expect(screen.getAllByRole('button')).toHaveLength(20);
  });

  it('previews through onInput and commits once, as a mesh paint in mesh space', () => {
    const { onChange, onInput } = mount(local(seedMeshPatch('#3366ccff')));
    drag('Patch 1 corner 3', { x: 250, y: 260 });

    expect(onInput).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as unknown as MeshGradientFill;
    expect(next.fill).toBe('mesh-gradient');
    expect(next.patches[0].points[6]).toEqual({ x: 120, y: 120 });
  });

  it('writes nothing for a press that never moved', () => {
    const { onChange } = mount(local(seedMeshPatch('#3366ccff')));
    const handle = screen.getByLabelText('Patch 1 corner 1');
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 10, clientY: 20, pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('nudges a handle with the arrow keys', () => {
    const { onChange } = mount(local(seedMeshPatch('#3366ccff')));
    fireEvent.keyDown(screen.getByLabelText('Patch 1 corner 1'), { key: 'ArrowRight', shiftKey: true });
    const next = onChange.mock.calls[0][0] as unknown as MeshGradientFill;
    // Ten overlay pixels at 2× is five mesh units.
    expect(next.patches[0].points[0]).toEqual({ x: 5, y: 0 });
  });
});
