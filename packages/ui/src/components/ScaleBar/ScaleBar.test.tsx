import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IMPERIAL_INCHES, type UnitScope } from '@weasel-js/quantity';
import { ScaleBar } from './ScaleBar';

const BOARD: UnitScope = { system: IMPERIAL_INCHES };

describe('ScaleBar', () => {
  it('labels the round length it spans', () => {
    render(<ScaleBar zoom={10} scopes={[BOARD]} />);
    expect(screen.getByRole('img', { name: 'Scale: 1ft' })).toHaveTextContent('1ft');
  });

  it('reads a magnified frame by its true lengths and says what size it is drawn at', () => {
    render(<ScaleBar zoom={10} scopes={[BOARD, { ...BOARD, drawnAt: 0.4 }]} />);
    expect(screen.getByRole('img', { name: 'Scale: 2ft, drawn at 0.4×' })).toHaveTextContent('2ftdrawn at 0.4×');
  });
});
