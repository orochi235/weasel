import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ControlPanel, resolveConfigSchema } from '@weasel-js/labkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShapeInstrument, START } from './ShapeInstrument';

afterEach(cleanup);

describe('the ShapeProperties panel', () => {
  const schema = resolveConfigSchema(ShapeInstrument.config!, []);

  it('heads each section of the rect schema, and opens the stroke whole in a dialog', () => {
    render(<ControlPanel schema={schema} config={START} setConfig={vi.fn()} />);
    expect(screen.getAllByText('Layout').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Edit Stroke' })).toBeTruthy();
  });

  it('edits rotation in degrees and writes radians', () => {
    const setConfig = vi.fn();
    render(<ControlPanel schema={schema} config={START} setConfig={setConfig} />);
    const field = screen.getByRole('spinbutton', { name: 'Rotation' });
    fireEvent.change(field, { target: { value: '90' } });
    fireEvent.blur(field);
    expect(setConfig).toHaveBeenCalledWith('pose.rotation', expect.closeTo(Math.PI / 2, 9));
  });
});
