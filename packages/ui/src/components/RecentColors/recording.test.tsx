import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { GradientFill } from '@weasel-js/core';
import { ColorField } from '../ColorField';
import { FillStrokeSwatch } from '../FillStrokeSwatch';
import { GradientEditor } from '../GradientEditor';
import { PaintInput } from '../PaintInput';
import { SwatchGrid } from '../SwatchGrid';
import { createRecentColorsStore } from './recentColors';
import { RecentColorsProvider } from './RecentColorsProvider';

function setup(ui: ReactNode) {
  const store = createRecentColorsStore({ storage: null });
  render(<RecentColorsProvider store={store}>{ui}</RecentColorsProvider>);
  return store;
}

function pick(label: string, value: string): void {
  const input = screen.getByLabelText(label);
  fireEvent.input(input, { target: { value } });
  fireEvent.blur(input);
}

const LINEAR: GradientFill = {
  fill: 'linear-gradient',
  from: { x: 0, y: 0 },
  to: { x: 100, y: 0 },
  stops: [
    { offset: 0, color: '#ff0000ff' },
    { offset: 1, color: '#0000ffff' },
  ],
  units: 'local',
};

describe('recent-color recording', () => {
  it('records a ColorField commit, not its live input', () => {
    const store = setup(<ColorField value="#112233ff" alpha onChange={() => {}} aria-label="Fill" />);
    fireEvent.input(screen.getByLabelText('Fill'), { target: { value: '#445566' } });
    expect(store.get()).toEqual([]);
    fireEvent.blur(screen.getByLabelText('Fill'));
    expect(store.get()).toEqual(['#445566ff']);
  });

  it('records nothing outside a provider', () => {
    const store = createRecentColorsStore({ storage: null });
    render(<ColorField value="#112233ff" onChange={() => {}} aria-label="Fill" />);
    pick('Fill', '#445566');
    expect(store.get()).toEqual([]);
  });

  it('records a gradient stop recolor', () => {
    const store = setup(<GradientEditor value={LINEAR} onChange={() => {}} />);
    pick('Stop 2 at 100%', '#00ff00');
    expect(store.get()).toEqual(['#00ff00ff']);
  });

  it("records PaintInput's solid body", () => {
    const store = setup(<PaintInput value={{ color: '#112233ff' }} onChange={() => {}} aria-label="Fill" />);
    pick('Fill', '#abcdef');
    expect(store.get()).toEqual(['#abcdefff']);
  });

  it('records a swatch applied from a SwatchGrid, on either target', () => {
    const store = setup(
      <SwatchGrid
        options={[{ value: null, label: 'None' }, { value: '#ff0000ff', label: 'Red' }, { value: '#00ff00ff', label: 'Green' }]}
        onChange={() => {}}
        onAltChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Red' }));
    fireEvent.click(screen.getByRole('button', { name: 'Green' }), { shiftKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'None' }));
    expect(store.get()).toEqual(['#00ff00ff', '#ff0000ff']);
  });

  it('records a FillStrokeSwatch pick', () => {
    const store = setup(
      <FillStrokeSwatch fill={{ color: '#ffffffff' }} stroke={{ color: '#000000ff' }} focused="fill" onFocusChange={() => {}} onChange={() => {}} />,
    );
    pick('Stroke', '#123456');
    expect(store.get()).toEqual(['#123456ff']);
  });

  it('records the color a FillStrokeSwatch consumer says it applied', () => {
    const store = setup(
      <FillStrokeSwatch
        fill={{ color: '#ffffffff' }}
        stroke={{ color: '#00000080' }}
        focused="fill"
        onFocusChange={() => {}}
        onChange={(_slot, color) => `${color}80`}
      />,
    );
    pick('Stroke', '#123456');
    expect(store.get()).toEqual(['#12345680']);
  });
});
