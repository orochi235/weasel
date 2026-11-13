import { fireEvent, screen } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it, vi } from 'vitest';
import { ResetGroup } from './ResetGroup';

const italic = {
  kind: 'boolean',
  name: 'Italic',
  default: false,
  encoding: {
    read: (stored: unknown) => stored === 'italic',
    write: (on: boolean) => (on ? 'italic' : 'normal'),
  },
} as const;
const group = { name: 'Type', children: { italic } } as unknown as PrefGroup;

describe('ResetGroup over an encoded leaf', () => {
  it('reads the stored value through its encoding, and resets it to holding nothing', () => {
    const setConfig = vi.fn();
    const { rerender } = renderWithIcons(
      <ResetGroup
        group={group}
        path="type"
        config={{ type: { italic: 'normal' } }}
        auto={new Set()}
        setConfig={setConfig}
      />,
    );
    expect(screen.getByRole('button', { name: 'Reset Type' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    rerender(
      <ResetGroup
        group={group}
        path="type"
        config={{ type: { italic: 'italic' } }}
        auto={new Set()}
        setConfig={setConfig}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset Type' }));
    expect(setConfig.mock.calls).toEqual([['type', { italic: undefined }]]);
  });
});
