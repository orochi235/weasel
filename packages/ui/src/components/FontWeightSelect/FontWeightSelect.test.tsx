import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const listFontWeights = vi.fn();

vi.mock('@weasel-js/font', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/font')>()),
  listFontWeights: (family: string) => listFontWeights(family),
}));

const { FontWeightSelect } = await import('./FontWeightSelect');

function options(): string[] {
  fireEvent.click(screen.getByRole('button'));
  return screen.getAllByRole('option').map((o) => o.textContent ?? '');
}

beforeEach(() => {
  listFontWeights.mockReset();
  listFontWeights.mockReturnValue([]);
});

describe('FontWeightSelect', () => {
  it("offers the family's registered weights", () => {
    listFontWeights.mockReturnValue([300, 400, 700]);
    render(<FontWeightSelect family="Inter" value={400} onChange={vi.fn()} />);
    expect(listFontWeights).toHaveBeenCalledWith('Inter');
    expect(options()).toEqual(['300 Light', '400 Regular', '700 Bold']);
  });

  it('keeps a value the family has no face for as its own entry', () => {
    listFontWeights.mockReturnValue([400, 700]);
    render(<FontWeightSelect family="Inter" value={550} onChange={vi.fn()} />);
    expect(options()).toEqual(['400 Regular', '550', '700 Bold']);
  });

  it('offers the CSS weights for a family with none on file, or no family', () => {
    render(<FontWeightSelect family="system-ui" value={400} onChange={vi.fn()} />);
    expect(options()).toHaveLength(9);
  });

  it('reports the picked weight as a number', () => {
    listFontWeights.mockReturnValue([400, 600]);
    const onChange = vi.fn();
    render(<FontWeightSelect family="Inter" value={400} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('option', { name: '600 Semibold' }));
    expect(onChange).toHaveBeenCalledWith(600);
  });

  it('shows Mixed and no selection when the sources disagree', () => {
    listFontWeights.mockReturnValue([400, 700]);
    render(<FontWeightSelect family="Inter" mixed onChange={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveTextContent('Mixed');
  });
});
