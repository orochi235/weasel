import { render, screen } from '@testing-library/react';
import { ActionsProvider, SelectionContextProvider } from '@orochi235/weasel';
import { RegistryInspector } from './RegistryInspector';

describe('RegistryInspector', () => {
  it('renders the page heading', () => {
    render(
      <ActionsProvider>
        <SelectionContextProvider>
          <RegistryInspector />
        </SelectionContextProvider>
      </ActionsProvider>,
    );
    expect(screen.getByRole('heading', { name: /bundle inspector/i })).toBeTruthy();
  });
});
