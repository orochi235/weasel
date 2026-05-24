import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ColorContextProvider, useColorContext } from './ColorContextProvider';

const noop = () => {};

function Consumer() {
  const colors = useColorContext();
  return <span data-testid="focus">{colors.focused}</span>;
}

describe('ColorContextProvider', () => {
  it('useColorContext reads focused from the surrounding provider', () => {
    const { getByTestId } = render(
      <ColorContextProvider
        initialFocus="stroke"
        updateSelected={noop}
      >
        <Consumer />
      </ColorContextProvider>,
    );
    expect(getByTestId('focus').textContent).toBe('stroke');
  });

  it('useColorContext throws when called outside a provider', () => {
    const orig = console.error;
    console.error = () => {};
    expect(() => render(<Consumer />)).toThrow(/ColorContextProvider/);
    console.error = orig;
  });

  it('defaults focused to "fill" when initialFocus is omitted', () => {
    const { getByTestId } = render(
      <ColorContextProvider updateSelected={noop}>
        <Consumer />
      </ColorContextProvider>,
    );
    expect(getByTestId('focus').textContent).toBe('fill');
  });
});
