import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BuiltInPalettes } from './SwatchStrip.stories';

function Host(): ReactElement {
  return <>{BuiltInPalettes.render!({} as never, {} as never)}</>;
}

describe('SwatchStrip stories', () => {
  it('shows the field unset after "None", so an opacity edit cannot apply the placeholder black', () => {
    render(<Host />);
    expect(screen.getByRole('slider', { name: 'Fill opacity' })).toBeEnabled();
    fireEvent.click(screen.getAllByRole('button', { name: 'None' })[0]);
    expect(screen.getByRole('slider', { name: 'Fill opacity' })).toBeDisabled();
  });
});
