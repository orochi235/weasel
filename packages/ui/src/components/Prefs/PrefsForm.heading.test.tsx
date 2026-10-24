import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrefsForm } from './PrefsForm';

afterEach(cleanup);

const flag = (name: string, more: Partial<PrefLeaf> = {}): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: false, ...more }) as PrefLeaf;
const num = (name: string, more: Partial<PrefLeaf> = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, ...more }) as PrefLeaf;

const SCHEMA: PrefGroup = {
  name: '',
  children: {
    view: {
      name: 'View',
      children: {
        shadow: { name: 'Shadow', children: { on: flag('Shadow on', { heading: true }), blur: num('Blur') } },
        glow: { name: 'Glow', as: 'panel', children: { on: flag('Glow on', { heading: true }), size: num('Size') } },
        edge: { name: 'Edge', children: { width: num('Width', { heading: true }), soft: flag('Soft') } },
        bare: { name: '', children: { on: flag('Bare on', { heading: true }) } },
      },
    },
  },
};

describe('a leaf marked `heading`', () => {
  it("is drawn in its section's heading, under the section's name, and has no row", () => {
    const onChange = vi.fn();
    render(<PrefsForm layout="rail" schema={SCHEMA} onChange={onChange} />);
    const heading = within(screen.getByRole('region', { name: 'Shadow' })).getByRole('heading');
    const control = within(heading).getByRole('checkbox', { name: 'Shadow' });
    expect(screen.queryByText('Shadow on')).toBeNull();
    expect(screen.getByRole('spinbutton', { name: 'Blur' })).toBeInTheDocument();
    fireEvent.click(control);
    expect(onChange).toHaveBeenCalledWith('view.shadow.on', true);
  });

  it("is drawn in a panel's title", () => {
    render(<PrefsForm layout="rail" schema={SCHEMA} onChange={() => {}} />);
    const heading = within(screen.getByRole('region', { name: 'Glow' })).getByRole('heading');
    expect(within(heading).getByRole('checkbox', { name: 'Glow' })).toBeInTheDocument();
    expect(screen.queryByText('Glow on')).toBeNull();
  });

  it('is drawn in the heading of a column', () => {
    render(<PrefsForm schema={SCHEMA.children.view as PrefGroup} onChange={() => {}} />);
    const heading = screen.getByRole('heading', { name: /Shadow/ });
    expect(within(heading).getByRole('checkbox', { name: 'Shadow' })).toBeInTheDocument();
    expect(screen.queryByText('Shadow on')).toBeNull();
  });

  it('carries its own path, so it can be selected where it is drawn', () => {
    render(<PrefsForm layout="rail" schema={SCHEMA} selected={['view.shadow.on']} onChange={() => {}} />);
    const control = screen.getByRole('checkbox', { name: 'Shadow' });
    expect(control.closest('[data-pref-path="view.shadow.on"]')).toHaveAttribute('data-selected');
  });

  it('is disabled there by its own enableIf', () => {
    const schema: PrefGroup = {
      name: '',
      children: {
        view: {
          name: 'View',
          children: {
            live: flag('Live'),
            shadow: { name: 'Shadow', children: { on: flag('Shadow on', { heading: true, enableIf: { path: 'view.live' } }) } },
          },
        },
      },
    };
    render(<PrefsForm layout="rail" schema={schema} onChange={() => {}} />);
    expect(screen.getByRole('checkbox', { name: 'Shadow' })).toBeDisabled();
  });

  it("switches its group: the group's enableIf reading it disables the rest and leaves it live", () => {
    const schema: PrefGroup = {
      name: '',
      children: {
        view: {
          name: 'View',
          children: {
            glow: { name: 'Glow', as: 'panel', enableIf: { path: 'view.glow.on' }, children: { on: flag('Glow on', { heading: true }), size: num('Size') } },
          },
        },
      },
    };
    const { rerender } = render(<PrefsForm layout="rail" schema={schema} values={{ view: { glow: { on: false } } }} onChange={() => {}} />);
    const panel = screen.getByRole('region', { name: 'Glow' });
    expect(within(panel).getByRole('checkbox', { name: 'Glow' })).toBeEnabled();
    expect(within(panel).getByRole('spinbutton', { name: 'Size' })).toBeDisabled();
    // The class is a proxy: the CSS-module proxy answers any key, so this shows only that the title asked to dim.
    expect(within(panel).getByText('Glow').className).toMatch(/_titleOff_/);
    rerender(<PrefsForm layout="rail" schema={schema} values={{ view: { glow: { on: true } } }} onChange={() => {}} />);
    expect(within(panel).getByRole('spinbutton', { name: 'Size' })).toBeEnabled();
    expect(within(panel).getByText('Glow').className).not.toMatch(/_titleOff_/);
  });

  it('stays a row where its control does not fit a heading, or its group has no heading', () => {
    render(<PrefsForm layout="rail" schema={SCHEMA} onChange={() => {}} />);
    expect(screen.getByRole('spinbutton', { name: 'Width' })).toBeInTheDocument();
    expect(screen.getByText('Width')).toBeInTheDocument();
    expect(screen.getByText('Bare on')).toBeInTheDocument();
  });

  it('stays a row where the form has its own renderer for the kind', () => {
    render(<PrefsForm layout="rail" schema={SCHEMA} onChange={() => {}} renderers={{ boolean: () => <i>own</i> }} />);
    expect(screen.getByText('Shadow on')).toBeInTheDocument();
  });
});
