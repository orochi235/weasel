import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';
import { createToolOptionValues, SHARED_TOOL_OPTIONS } from '@weasel-js/core';

const begin = vi.hoisted(() => vi.fn());
vi.mock('@weasel-js/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/core')>()),
  useActionsRegistry: () => ({ begin }),
}));

import { ColorContextProvider } from './tools/colorContext';
import { usePickColor } from './usePickColor';

describe('usePickColor', () => {
  it('paints the selection with the paint it gave the active swatch', () => {
    const end = vi.fn();
    begin.mockReturnValue({ end });
    const values = createToolOptionValues();
    values.set(SHARED_TOOL_OPTIONS, 'fill', { color: '#336699', opacity: 0.5 });
    const { result } = renderHook(() => usePickColor(), {
      wrapper: ({ children }: { children: ReactNode }) => <ColorContextProvider values={values}>{children}</ColorContextProvider>,
    });
    result.current('#ff0000');
    const paint = { color: '#ff0000', opacity: 0.5 };
    expect(values.get(SHARED_TOOL_OPTIONS).fill).toEqual(paint);
    expect(begin).toHaveBeenCalledWith('setFill', { paint });
    expect(end).toHaveBeenCalledWith('commit');
  });
});
