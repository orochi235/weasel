import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StagePalette } from './StagePalette';
import { CHART_STAGE_TYPES } from './stageTypes';

afterEach(cleanup);

describe('StagePalette', () => {
  it('lists every stage type under "Stages"', () => {
    render(<StagePalette onAdd={() => {}} />);
    expect(screen.getByText('Stages')).toBeTruthy();
    expect(screen.getAllByRole('row').map((r) => r.textContent)).toEqual(CHART_STAGE_TYPES.map((t) => t.title));
  });

  it("adds the activated row's stage type", () => {
    const onAdd = vi.fn();
    render(<StagePalette onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('row', { name: 'Blur' }));
    expect(onAdd).toHaveBeenCalledWith(CHART_STAGE_TYPES.find((t) => t.type === 'blur'));
  });
});
