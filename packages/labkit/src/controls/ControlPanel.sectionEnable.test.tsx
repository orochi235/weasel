import { fireEvent, screen } from '@testing-library/react';
import type { PrefLeaf } from '@weasel-js/prefs';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it, vi } from 'vitest';
import type { ResolvedConfig } from '../config/types';
import { ControlPanel } from './ControlPanel';

const flag = (name: string): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false }) as PrefLeaf;
const num = (name: string): PrefLeaf => ({ kind: 'number', name, description: '', default: 0 }) as PrefLeaf;

const schema: ResolvedConfig = {
  group: {
    name: 'root',
    children: {
      stroke: {
        kind: 'object',
        name: 'Stroke',
        description: '',
        default: {},
        children: { edge: { name: 'Edge', enableIf: { path: 'stroke.on' }, members: { on: flag('Edge on'), width: num('Width') } } },
      } as PrefLeaf,
    },
  },
  sections: [],
  showIf: new Map(),
  renderers: {},
  dialogs: {},
};

// The classes are a proxy: the CSS-module proxy answers any key, so these show only that a title asked to dim.
const dimmed = (el: Element): boolean => el.closest('[class*="_off_"], [class*="_titleOff_"]') !== null;

describe("<ControlPanel> a section of an object leaf its enableIf turns off", () => {
  it.each([false, true])('on: %s — dims its title only while off, and leaves its switch field live', (on) => {
    renderWithIcons(<ControlPanel schema={schema} config={{ stroke: { on, width: 1 } }} setConfig={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Stroke' }));
    expect(dimmed(screen.getByText('Edge'))).toBe(!on);
    expect(screen.getByRole('checkbox', { name: 'Edge on' })).toBeEnabled();
  });
});
