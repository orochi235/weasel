import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ColorContextProvider, useColorContext } from './ColorContext';
import type { ColorContextApi } from './useColorContextTool';

function Consumer() {
  const colors = useColorContext();
  return <span data-testid="focus">{colors.focused}</span>;
}

const fakeApi: ColorContextApi = {
  fill: { kind: 'solid', color: '#ffffffff' },
  stroke: { kind: 'solid', color: '#000000ff' },
  focused: 'stroke',
  setFill: () => {}, setStroke: () => {}, setFocused: () => {}, setFocus: () => {},
  setFillColor: () => {}, setStrokeColor: () => {}, setFocusedColor: () => {},
  focusedAlpha: 1, setFocusedAlpha: () => {},
  swap: () => {}, swapFocus: () => {}, toggleFocusedNone: () => {},
  toggleFocusedTransparent: () => {}, reset: () => {},
  applyFillToSelection: () => {}, applyStrokeToSelection: () => {},
  applyStrokeWidthToSelection: () => {},
};

describe('ColorContext', () => {
  it('useColorContext reads from the surrounding provider', () => {
    const { getByTestId } = render(
      <ColorContextProvider value={fakeApi}>
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
});
