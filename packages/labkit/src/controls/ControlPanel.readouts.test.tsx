import { fireEvent, render, screen } from '@testing-library/react';
import { compact } from '@weasel-js/quantity';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

describe('<ControlPanel> suffix', () => {
  const panel = (node: ReturnType<typeof f.number>) =>
    render(
      <ControlPanel
        schema={resolveConfigSchema(f.schema({ width: node.label('Width') }), [])}
        config={{ width: 20 }}
        setConfig={vi.fn()}
      />,
    );

  it('suffixes a slider readout with the suffix the leaf declares', () => {
    const { container } = panel(f.number(20).range(0, 100).slider().suffix('px'));
    expect(container.querySelector('input[type="range"]')).not.toBeNull();
    expect(container.textContent).toContain('px');
  });

  it('suffixes a typed number with the suffix the leaf declares', () => {
    const { container } = panel(f.number(20).input().suffix('px'));
    expect(container.querySelector('input[role="spinbutton"]')).not.toBeNull();
    expect(container.textContent).toContain('px');
  });
});

describe('<ControlPanel> format', () => {
  it('shows a slider readout in the format the leaf declares', () => {
    render(
      <ControlPanel
        schema={resolveConfigSchema(
          f.schema({ glyphs: f.number(0).range(0, 2_000_000).display(compact()) }),
          [],
        )}
        config={{ glyphs: 2_000_000 }}
        setConfig={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue('2.00M')).toBeInTheDocument();
  });
});

describe('<ControlPanel> unit', () => {
  const degrees = {
    toDisplay: (stored: number) => (stored * 180) / Math.PI,
    fromDisplay: (shown: number) => (shown * Math.PI) / 180,
    suffix: '°',
  };
  const angle = (node: ReturnType<typeof f.number>, stored: number, setConfig = vi.fn()) => {
    render(
      <ControlPanel
        schema={resolveConfigSchema(f.schema({ angle: node.label('Angle') }), [])}
        config={{ angle: stored }}
        setConfig={setConfig}
      />,
    );
    return setConfig;
  };

  it('shows a radians-backed number in its display unit', () => {
    angle(f.number(0).input().unit(degrees), Math.PI / 2);
    expect((screen.getByLabelText('Angle') as HTMLInputElement).value).toBe('90');
  });

  it('stores a typed display value back in the canonical unit', () => {
    const setConfig = angle(f.number(0).input().unit(degrees), Math.PI / 2);
    fireEvent.change(screen.getByLabelText('Angle'), { target: { value: '45' } });
    fireEvent.blur(screen.getByLabelText('Angle'));
    expect(setConfig.mock.calls[0][0]).toBe('angle');
    expect(setConfig.mock.calls[0][1] as number).toBeCloseTo(Math.PI / 4, 10);
  });

  it('round-trips a value edited away and back', () => {
    // Live config, because the corruption this guards against only shows on
    // the second edit: what the field stores has to read back as what it showed.
    function Live() {
      const [config, setConfig] = useState<Record<string, unknown>>({ angle: Math.PI / 2 });
      return (
        <ControlPanel
          schema={resolveConfigSchema(
            f.schema({ angle: f.number(0).input().unit(degrees).label('Angle') }),
            [],
          )}
          config={config}
          setConfig={(path, value) => setConfig((prev) => ({ ...prev, [path]: value }))}
        />
      );
    }
    render(<Live />);
    const field = () => screen.getByLabelText('Angle') as HTMLInputElement;
    expect(field().value).toBe('90');
    fireEvent.change(field(), { target: { value: '45' } });
    expect(field().value).toBe('45');
    fireEvent.change(field(), { target: { value: '90' } });
    expect(field().value).toBe('90');
  });

  it('converts a slider’s bounds into the display unit', () => {
    angle(f.number(0).range(0, Math.PI).unit(degrees), Math.PI / 2);
    const slider = screen.getByRole('slider') as HTMLInputElement;
    expect(slider.min).toBe('0');
    expect(slider.max).toBe('180');
    expect(slider.value).toBe('90');
  });

  it('clamps a typed value against the bounds in display space', () => {
    // 100 is inside 0..180 degrees and outside 0..π radians, so clamping
    // against the stored bounds would cut a legal angle down to π.
    const setConfig = angle(f.number(0).range(0, Math.PI).input().unit(degrees), Math.PI / 2);
    fireEvent.change(screen.getByLabelText('Angle'), { target: { value: '100' } });
    fireEvent.blur(screen.getByLabelText('Angle'));
    expect(setConfig.mock.calls[0][1] as number).toBeCloseTo((100 * Math.PI) / 180, 10);
  });
});

describe('<ControlPanel> endless number', () => {
  it('reads its word at the stop past the top of the range and writes Infinity there', () => {
    const schema = resolveConfigSchema(
      f.schema({ cut: f.number(Infinity).range(0, 5000).step(50).suffix('ms').endless('never') }),
      [],
    );
    const setConfig = vi.fn();
    function Harness() {
      const [config, setState] = useState<Record<string, unknown>>({ cut: Infinity });
      return (
        <ControlPanel
          schema={schema}
          config={config}
          setConfig={(key: string, value: unknown) => {
            setConfig(key, value);
            setState((c) => ({ ...c, [key]: value }));
          }}
        />
      );
    }
    render(<Harness />);
    expect(screen.getByRole('spinbutton')).toHaveValue('never');
    expect(screen.queryByText('ms')).toBeNull();
    fireEvent.change(screen.getByRole('slider'), { target: { value: '4950' } });
    expect(setConfig).toHaveBeenLastCalledWith('cut', 4950);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '5000' } });
    expect(setConfig).toHaveBeenLastCalledWith('cut', 5000);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '5050' } });
    expect(setConfig).toHaveBeenLastCalledWith('cut', Infinity);
  });
});
