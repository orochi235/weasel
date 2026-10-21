import { describe, it, expect } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import {
  ActionsProvider,
  createKeymapStack,
  DepRegistryProvider,
  key,
  useAction,
  useDepSource,
  type Action,
  type KeymapStack,
} from '@weasel-js/core';
import { KeymapHint } from './KeymapHint';

const zoom: Action = { id: 'zoom', label: 'Zoom in' };

function Surface({ stack }: { stack: KeymapStack }) {
  useDepSource('keymaps', () => stack);
  useAction(zoom);
  return <KeymapHint />;
}

describe('KeymapHint', () => {
  it('shows nothing until a keymap opens, then its label and rows, Escape first', () => {
    const stack = createKeymapStack();
    render(
      <DepRegistryProvider>
        <ActionsProvider>
          <Surface stack={stack} />
        </ActionsProvider>
      </DepRegistryProvider>,
    );
    expect(screen.queryByRole('status')).toBeNull();
    act(() => { stack.push('loupe', 'Loupe', { bindings: [{ spec: key('2'), actionId: 'zoom' }] }); });
    const hint = screen.getByRole('status');
    expect(hint).toHaveAccessibleName('Loupe');
    expect([...hint.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      expect.stringContaining('Close'),
      expect.stringContaining('Zoom in'),
    ]);
    act(() => { stack.closeAll(); });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
