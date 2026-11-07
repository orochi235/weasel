import { fireEvent, render, screen } from '@testing-library/react';
import { prefLeafAt } from '@weasel-js/prefs';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

const schema = resolveConfigSchema(
  f.schema({ segments: f.number(16).range(1, 1000).step(1).scale('log') }),
  [],
);

describe('<ControlPanel> a number with a scale', () => {
  it('carries the scale onto the prefs leaf', () => {
    expect(prefLeafAt(schema.group, 'segments')).toMatchObject({ scale: 'log', min: 1, max: 1000 });
  });

  it('lands a drag to the middle of a log track near √1000, stored on its step', () => {
    const setConfig = vi.fn();
    render(<ControlPanel schema={schema} config={{ segments: 16 }} setConfig={setConfig} />);
    const track = screen.getByRole('slider') as HTMLInputElement;
    expect(Number(track.value)).toBeCloseTo(Math.log10(16) / 3, 9);
    fireEvent.change(track, { target: { value: '0.5' } });
    expect(setConfig).toHaveBeenLastCalledWith('segments', 32);
  });

  it('lands the middle on √1000 to the step it is given', () => {
    const fine = resolveConfigSchema(
      f.schema({ segments: f.number(16).range(1, 1000).step(0.1).scale('log') }),
      [],
    );
    const setConfig = vi.fn();
    render(<ControlPanel schema={fine} config={{ segments: 16 }} setConfig={setConfig} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0.5' } });
    expect(setConfig).toHaveBeenLastCalledWith('segments', 31.6);
  });

  it("keeps the readout typing and stepping in the value's own units", () => {
    const setConfig = vi.fn();
    render(<ControlPanel schema={schema} config={{ segments: 16 }} setConfig={setConfig} />);
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'ArrowUp' });
    expect(setConfig).toHaveBeenLastCalledWith('segments', 17);
  });
});
