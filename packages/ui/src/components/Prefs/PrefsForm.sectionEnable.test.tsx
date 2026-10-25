import { cleanup, render, screen } from '@testing-library/react';
import type { PrefGroup, PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { afterEach, describe, expect, it } from 'vitest';
import { PrefsForm } from './PrefsForm';

afterEach(cleanup);

const flag = (name: string): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false }) as PrefLeaf;
const num = (name: string): PrefLeaf => ({ kind: 'number', name, description: '', default: 0 }) as PrefLeaf;

// The classes are a proxy: the CSS-module proxy answers any key, so these show only that a title asked to dim.
const dimmed = (el: Element): boolean => el.closest('[class*="_off_"], [class*="_titleOff_"]') !== null;

const schemaWith = (as?: PrefSection['as']): PrefGroup => ({
  name: '',
  children: {
    view: {
      name: 'View',
      children: {
        stroke: {
          kind: 'object',
          name: 'Stroke',
          description: '',
          default: {},
          children: {
            edge: { name: 'Edge', ...(as ? { as } : {}), enableIf: { path: 'view.stroke.on' }, members: { on: flag('Edge on'), width: num('Width') } },
          },
        } as PrefLeaf,
      },
    },
  },
});

describe("a section of an object leaf its enableIf turns off, in PrefsForm", () => {
  it.each([undefined, 'panel'] as const)('as %s: dims its title and leaves its switch field live', (as) => {
    render(<PrefsForm layout="rail" schema={schemaWith(as)} values={{ view: { stroke: { on: false, width: 1 } } }} onChange={() => {}} />);
    expect(dimmed(screen.getByText('Edge'))).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'Edge on' })).toBeEnabled();
    expect(screen.getByRole('spinbutton', { name: 'Width' })).toBeDisabled();
  });

  it('does not dim it while the condition holds', () => {
    render(<PrefsForm layout="rail" schema={schemaWith()} values={{ view: { stroke: { on: true, width: 1 } } }} onChange={() => {}} />);
    expect(dimmed(screen.getByText('Edge'))).toBe(false);
  });
});
