import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { IMAGE_STAGE_TYPES } from '@weasel-js/diagram/effect';
import { AUDIO_STAGE_TYPES } from '@weasel-js/diagram/effect-audio';
import { StagePalette } from './StagePalette';

afterEach(cleanup);

describe('StagePalette', () => {
  it('lists every stage type under "Stages"', () => {
    render(<StagePalette onAdd={() => {}} />);
    expect(screen.getByText('Stages')).toBeTruthy();
    expect(screen.getAllByRole('row').map((r) => r.textContent)).toEqual(IMAGE_STAGE_TYPES.map((t) => t.title));
  });

  it("adds the activated row's stage type", () => {
    const onAdd = vi.fn();
    render(<StagePalette onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('row', { name: 'Blur' }));
    expect(onAdd).toHaveBeenCalledWith(IMAGE_STAGE_TYPES.find((t) => t.type === 'blur'));
  });

  it('lists audio stages once Audio is chosen, and adds the activated one', () => {
    const onAdd = vi.fn();
    render(<StagePalette onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Audio' }));
    expect(screen.queryByRole('row', { name: 'Blur' })).toBeNull();
    fireEvent.click(screen.getByRole('row', { name: 'Delay' }));
    expect(onAdd).toHaveBeenCalledWith(AUDIO_STAGE_TYPES.find((t) => t.type === 'audio.delay'));
  });
});
