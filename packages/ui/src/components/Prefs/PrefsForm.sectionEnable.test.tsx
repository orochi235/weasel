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
            edge: { name: 'Edge', ...(as ? { as } : {}), ...(as === 'bar' ? { lead: 'label' as const } : {}), enableIf: { path: 'view.stroke.on' }, members: { on: flag('Edge on'), width: num('Width') } },
          },
        } as PrefLeaf,
      },
    },
  },
});

describe("a section of an object leaf its enableIf turns off, in PrefsForm", () => {
  it.each([undefined, 'panel', 'tab'] as const)('as %s: dims its title and leaves its switch field live', (as) => {
    render(<PrefsForm layout="rail" schema={schemaWith(as)} values={{ view: { stroke: { on: false, width: 1 } } }} onChange={() => {}} />);
    expect(dimmed(screen.getByText('Edge'))).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'Edge on' })).toBeEnabled();
    expect(screen.getByRole('spinbutton', { name: 'Width' })).toBeDisabled();
  });

  it('as bar: dims its label and leaves its switch field live', () => {
    render(<PrefsForm layout="rail" schema={schemaWith('bar')} values={{ view: { stroke: { on: false, width: 1 } } }} onChange={() => {}} />);
    expect(dimmed(screen.getByText('Edge'))).toBe(true);
    expect(screen.getByRole('button', { name: 'Edge on' })).toBeEnabled();
  });

  it.each([undefined, 'tab', 'bar'] as const)('as %s: does not dim it while the condition holds', (as) => {
    render(<PrefsForm layout="rail" schema={schemaWith(as)} values={{ view: { stroke: { on: true, width: 1 } } }} onChange={() => {}} />);
    expect(dimmed(screen.getByText('Edge'))).toBe(false);
  });
});

const groupsWith = (as: 'tab' | 'bar'): PrefGroup => ({
  name: '',
  children: {
    view: {
      name: 'View',
      children: {
        on: flag('Edge on'),
        edge: { name: 'Edge', as, ...(as === 'bar' ? { lead: 'label' as const } : {}), enableIf: { path: 'view.on' }, children: { width: num('Width') } },
      },
    },
  },
});

describe("a group its enableIf turns off, in PrefsForm", () => {
  it.each(['tab', 'bar'] as const)('as %s: dims its name only while off', (as) => {
    render(<PrefsForm layout="rail" schema={groupsWith(as)} values={{ view: { on: false, edge: { width: 1 } } }} onChange={() => {}} />);
    expect(dimmed(screen.getByText('Edge'))).toBe(true);
    expect(screen.getByRole('spinbutton', { name: 'Width' })).toBeDisabled();
    cleanup();
    render(<PrefsForm layout="rail" schema={groupsWith(as)} values={{ view: { on: true, edge: { width: 1 } } }} onChange={() => {}} />);
    expect(dimmed(screen.getByText('Edge'))).toBe(false);
  });
});
