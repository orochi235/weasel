import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { seedMeshPatch, type FillStyle, type MeshGradientFill } from '@weasel-js/core';
import { MeshEditor } from './MeshEditor';
import { PaintInput } from '../PaintInput';

const MESH = seedMeshPatch('#ff0000ff') as MeshGradientFill;

describe('MeshEditor', () => {
  it('renders one swatch per corner, numbered in the patch walk order', () => {
    render(<MeshEditor value={MESH} onChange={() => {}} />);
    for (let i = 1; i <= 4; i++) {
      expect(screen.getByLabelText(`Patch 1 corner ${i}`)).toBeInTheDocument();
    }
  });

  it('recolors one corner and leaves the geometry alone', () => {
    const onChange = vi.fn();
    render(<MeshEditor value={MESH} onChange={onChange} />);
    const swatch = screen.getByLabelText('Patch 1 corner 2');
    fireEvent.input(swatch, { target: { value: '#00ff00' } });
    fireEvent.blur(swatch);

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as MeshGradientFill;
    expect(next.patches[0].colors[1]).toBe('#00ff00ff');
    expect(next.patches[0].colors[0]).toBe(MESH.patches[0].colors[0]);
    expect(next.patches[0].points).toEqual(MESH.patches[0].points);
  });

  it('commits the blend space', () => {
    const onChange = vi.fn();
    render(<MeshEditor value={MESH} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'OKLab' }));
    expect(onChange.mock.calls[0][0]).toMatchObject({ interpolate: 'oklab' });
  });

  it('numbers the patches when there is more than one', () => {
    const two: MeshGradientFill = { ...MESH, patches: [MESH.patches[0], MESH.patches[0]] };
    render(<MeshEditor value={two} onChange={() => {}} />);
    expect(screen.getByLabelText('Patch 2 corner 1')).toBeInTheDocument();
  });
});

describe('PaintInput holding a mesh', () => {
  it('edits it as a mesh rather than flattening it to a solid', () => {
    const onChange = vi.fn();
    render(<PaintInput value={MESH as unknown as FillStyle} onChange={onChange} aria-label="Fill" />);
    const swatch = screen.getByLabelText('Patch 1 corner 1');
    fireEvent.input(swatch, { target: { value: '#0000ff' } });
    fireEvent.blur(swatch);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({ fill: 'mesh-gradient' });
  });

  it('lights the mesh segment in the kind bar', () => {
    render(<PaintInput value={MESH as unknown as FillStyle} onChange={() => {}} aria-label="Fill" />);
    expect(screen.getByRole('radio', { name: 'Mesh' })).toBeChecked();
  });
});
