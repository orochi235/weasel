import { fireEvent, screen } from '@testing-library/react';
import { AUTO, type PrefGroup } from '@weasel-js/prefs';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it, vi } from 'vitest';
import type { ResolvedConfig } from '../config/types';
import { labConfigSource } from './labSource';
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
const gap = { kind: 'number', name: 'Gap', default: 4, auto: { on: true } } as const;
const size = { kind: 'number', name: 'Size', default: 10 } as const;
const group = { name: 'Type', children: { italic, gap, size } } as unknown as PrefGroup;
const resolved = {
  group: { name: '', children: { type: group } },
  sections: [],
  renderers: {},
  dialogs: {},
  showIf: new Map(),
} as unknown as ResolvedConfig;

const at = (config: Record<string, unknown>, setConfig = vi.fn(), auto = new Set<string>(['type.gap'])) =>
  labConfigSource({ resolved, config, shown: config, setConfig, auto, setRowAuto: () => {} });

describe('ResetGroup', () => {
  it('reads an encoded leaf through its encoding, and resets it to holding nothing', () => {
    const setConfig = vi.fn();
    const { rerender } = renderWithIcons(
      <ResetGroup group={group} path="type" source={at({ type: { italic: 'normal', gap: 4, size: 10 } }, setConfig)} />,
    );
    expect(screen.getByRole('button', { name: 'Reset Type' })).toHaveAttribute('aria-disabled', 'true');
    rerender(
      <ResetGroup group={group} path="type" source={at({ type: { italic: 'italic', gap: 4, size: 10 } }, setConfig)} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset Type' }));
    // The group's value is written whole: a leaf the reset leaves unpinned keeps its sentinel.
    expect(setConfig.mock.calls).toEqual([['type', { italic: undefined, gap: AUTO, size: 10 }]]);
  });

  it('unpins a leaf that starts auto and pins the rest at their defaults, in one write', () => {
    const setConfig = vi.fn();
    renderWithIcons(
      <ResetGroup group={group} path="type" source={at({ type: { gap: 9, size: 3 } }, setConfig, new Set())} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset Type' }));
    expect(setConfig.mock.calls).toEqual([['type', { gap: AUTO, size: 10 }]]);
  });
});
