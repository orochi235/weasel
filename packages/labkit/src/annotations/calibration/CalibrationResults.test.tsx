import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { expect, it } from 'vitest';
import { AnnotationsContext } from '../AnnotationsContext';
import { createAnnotationStore } from '../store';
import { CalibrationResults } from './CalibrationResults';
import { DEFAULT_CONDITION } from './condition';

it('says the copy failed on a page with no clipboard, rather than throwing', async () => {
  const store = createAnnotationStore({ targets: () => [] });
  renderWithIcons(
    <AnnotationsContext.Provider value={store}>
      <CalibrationResults config={DEFAULT_CONDITION} picture={{ current: null }} />
    </AnnotationsContext.Provider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Copy report' }));
  await waitFor(() => expect(screen.getByText(/copy failed/)).toBeTruthy());
});
