import { describe, it, expect, vi } from 'vitest';
import { act, screen, fireEvent } from '@testing-library/react';
import { asPaint, registerPaintKind, type Paint } from '@weasel-js/core';
import { PaintField } from './PaintField';
import { renderWithIcons } from '../../testing/withIcons';

const GRADIENT: Paint = {
  kind: 'linear-gradient',
  from: { x: 0, y: 0 },
  to: { x: 1, y: 0 },
  stops: [
    { offset: 0, color: '#ff0000ff' },
    { offset: 1, color: '#0000ffff' },
  ],
  units: 'bounds',
};

describe('PaintField', () => {
  it('names the kind it is holding, so a closed field still says what it is', () => {
    renderWithIcons(<PaintField value={GRADIENT} onChange={() => {}} aria-label="Fill" />);
    expect(screen.getByRole('button', { name: /Fill/ })).toHaveTextContent('Linear');
  });

  it('labels a kind registered after it mounted', () => {
    renderWithIcons(
      <PaintField value={asPaint({ kind: 'noise', color: '#112233ff' })} onChange={() => {}} aria-label="Fill" />,
    );
    expect(screen.getByRole('button', { name: /Fill/ })).toHaveTextContent('noise');
    let dispose = (): void => {};
    act(() => {
      dispose = registerPaintKind({
        id: 'noise',
        label: 'Noise',
        seed: (color) => asPaint({ kind: 'noise', color }),
        colorOf: (paint) => (paint as unknown as { color?: string }).color,
      });
    });
    try {
      expect(screen.getByRole('button', { name: /Fill/ })).toHaveTextContent('Noise');
    } finally {
      act(() => { dispose(); });
    }
  });

  it('opens the whole paint editor, not a color input', () => {
    renderWithIcons(<PaintField value={GRADIENT} onChange={() => {}} aria-label="Fill" />);
    fireEvent.click(screen.getByRole('button', { name: /Fill/ }));
    expect(screen.getByLabelText('Stop 1')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Radial' })).toBeInTheDocument();
  });

  it('keeps a gradient a gradient when a stop is recolored', () => {
    const onChange = vi.fn();
    renderWithIcons(<PaintField value={GRADIENT} onChange={onChange} aria-label="Fill" />);
    fireEvent.click(screen.getByRole('button', { name: /Fill/ }));
    const swatch = screen.getByLabelText('Stop 1');
    fireEvent.input(swatch, { target: { value: '#00ff00' } });
    fireEvent.blur(swatch);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({
      kind: 'linear-gradient',
      from: { x: 0, y: 0 },
      to: { x: 1, y: 0 },
      stops: [
        { offset: 0, color: '#00ff00ff' },
        { offset: 1, color: '#0000ffff' },
      ],
    });
  });

  it('says so when the paint is mixed across a selection', () => {
    renderWithIcons(<PaintField value={undefined} mixed onChange={() => {}} aria-label="Fill" />);
    expect(screen.getByRole('button', { name: /Fill/ })).toHaveTextContent('Mixed');
  });

  it('says so when there is no paint at all', () => {
    renderWithIcons(<PaintField value={null} onChange={() => {}} aria-label="Fill" />);
    expect(screen.getByRole('button', { name: /Fill/ })).toHaveTextContent('None');
  });
});
