import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ActionsProvider, useAction } from '@weasel-js/routing/react';
import { usePaletteItems } from './usePaletteItems';

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <ActionsProvider>
      <Group />
      {children}
    </ActionsProvider>
  );
}

function Group() {
  useAction({ id: 'group', label: 'Group', invoker: { timing: 'immediate' as const, run: () => {} } });
  return null;
}

describe('usePaletteItems', () => {
  it('keeps the list it last showed once closed, for the dialog fading out', () => {
    const { result, rerender } = renderHook(({ open }) => usePaletteItems(open, ''), {
      wrapper: Wrapper,
      initialProps: { open: false },
    });
    rerender({ open: true });
    expect(result.current.filtered.map((i) => i.label)).toEqual(['Group']);
    rerender({ open: false });
    expect(result.current.filtered.map((i) => i.label)).toEqual(['Group']);
  });
});
