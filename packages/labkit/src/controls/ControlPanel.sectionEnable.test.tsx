import { fireEvent, screen } from '@testing-library/react';
import type { PrefLeaf } from '@weasel-js/prefs';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it, vi } from 'vitest';
import type { ResolvedConfig } from '../config/types';
import { ControlPanel } from './ControlPanel';

const flag = (name: string): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: false }) as PrefLeaf;
const num = (name: string): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0 }) as PrefLeaf;

const schema: ResolvedConfig = {
  group: {
    name: 'root',
    children: {
      stroke: {
        kind: 'object',
        name: 'Stroke',
        description: '',
        default: {},
        children: {
          edge: {
            name: 'Edge',
            enableIf: { path: 'stroke.on' },
            members: { on: flag('Edge on'), width: num('Width') },
          },
        },
      } as PrefLeaf,
    },
  },
  sections: [],
  showIf: new Map(),
  renderers: {},
  dialogs: {},
};

// The classes are a proxy: the CSS-module proxy answers any key, so these show only that a title asked to dim.
const dimmed = (el: Element): boolean =>
  el.closest('[class*="_off_"], [class*="_titleOff_"]') !== null;

describe('<ControlPanel> a section of an object leaf its enableIf turns off', () => {
  it.each([false, true])(
    'on: %s — dims its title only while off, and leaves its switch field live',
    (on) => {
      renderWithIcons(
        <ControlPanel schema={schema} config={{ stroke: { on, width: 1 } }} setConfig={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Edit Stroke' }));
      expect(dimmed(screen.getByText('Edge'))).toBe(!on);
      expect(screen.getByRole('checkbox', { name: 'Edge on' })).toBeEnabled();
    },
  );
});

const grouped = (as: 'tab' | 'bar'): ResolvedConfig => ({
  ...schema,
  group: {
    name: 'root',
    children: {
      on: flag('Edge on'),
      edge: {
        name: 'Edge',
        as,
        ...(as === 'bar' ? { lead: 'label' as const } : {}),
        enableIf: { path: 'on' },
        children: { width: num('Width') },
      },
    },
  },
});

describe('<ControlPanel> a group its enableIf turns off', () => {
  it.each([
    ['tab', false],
    ['tab', true],
    ['bar', false],
    ['bar', true],
  ] as const)('as %s, on: %s — dims its name only while off', (as, on) => {
    renderWithIcons(
      <ControlPanel schema={grouped(as)} config={{ on, edge: { width: 1 } }} setConfig={vi.fn()} />,
    );
    expect(dimmed(screen.getByText('Edge'))).toBe(!on);
  });
});

describe('<ControlPanel> a tab with no row to draw', () => {
  it('is left out of its strip, and neither it nor a hidden row between tabs splits the strip', () => {
    const resolved: ResolvedConfig = {
      ...schema,
      group: {
        name: 'root',
        children: {
          one: { name: 'One', as: 'tab', children: { a: flag('Alpha') } },
          gone: { name: 'Gone', as: 'tab', children: { z: flag('Zeta') } },
          gap: flag('Gap'),
          two: { name: 'Two', as: 'tab', children: { b: flag('Beta') } },
          empty: { name: 'Empty', as: 'tab', children: {} },
        },
      },
      showIf: new Map([
        ['gone.z', () => false],
        ['gap', () => false],
      ]),
    };
    renderWithIcons(<ControlPanel schema={resolved} config={{}} setConfig={vi.fn()} />);
    expect(screen.getAllByRole('tablist')).toHaveLength(1);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['One', 'Two']);
  });
});
