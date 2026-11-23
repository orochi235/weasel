import '../../labTestSetup';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { Lab } from '@weasel-js/labkit';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, describe, expect, it } from 'vitest';
import { ShapesInstrument } from './ShapesInstrument';

afterEach(cleanup);

describe('the shapes gallery', () => {
  it('shows the params as they are now, not as they were when copied', async () => {
    await renderSettled(<Lab instruments={[ShapesInstrument]} />, { wrapper: withIcons });
    fireEvent.click(screen.getByRole('button', { name: 'Copy changed params' }));
    const shown = screen.getByRole('textbox', { name: 'Changed params' });
    expect(shown).toHaveValue('// (no changes from defaults)');
    fireEvent.change(screen.getAllByRole('slider')[0]!, { target: { value: '0.5' } });
    expect(shown).not.toHaveValue('// (no changes from defaults)');
  });
});
