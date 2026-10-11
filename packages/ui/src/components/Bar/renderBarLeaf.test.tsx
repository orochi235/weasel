import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PrefLeaf } from '@weasel-js/prefs';
import { renderPrefControl, type PrefRenderContext } from '../Prefs/PrefsRow';
import { renderBuiltin, type PropertyRenderContext } from '../SelectionPanel/renderLeaf';
import { renderBarLeaf, withBarLabel } from './renderBarLeaf';

const size: PrefLeaf = { kind: 'number', name: 'Size', description: 'Type size.', default: 12 };
const snap: PrefLeaf = { kind: 'boolean', name: 'Snap', description: 'Snap to the grid.', default: false };
const margins: PrefLeaf = {
  kind: 'object',
  name: 'Margins',
  description: 'Space around the page.',
  default: { top: 4 },
  children: { top: { kind: 'number', name: 'Top', description: 'Above.', default: 4 } },
};

/** The words a bar sets before a control, which a row never draws. */
const barLabel = (root: HTMLElement): string | undefined =>
  root.querySelector('[data-bar-label]')?.textContent ?? undefined;

function panelCtx(pref: PrefLeaf): PropertyRenderContext {
  return {
    path: 'p',
    pref,
    value: pref.default,
    mixed: false,
    unset: false,
    each: [pref.default],
    setValue: () => {},
    update: () => {},
    valueAt: () => ({ value: undefined, mixed: false }),
  };
}

function prefCtx(pref: PrefLeaf): PrefRenderContext {
  return { path: 'p', pref, value: pref.default, setValue: () => {}, auto: false, setAuto: () => {} };
}

describe('renderBarLeaf', () => {
  it('draws a leaf that is one control as a bar field', () => {
    const field = { kind: 'number', value: 12, onChange: () => {} } as const;
    const { container } = render(<>{renderBarLeaf({ leaf: size, name: 'Size', field, row: () => null })}</>);
    expect(barLabel(container)).toBe('Size');
    expect(screen.getByLabelText('Size')).toBeInTheDocument();
  });

  it('opens a leaf made of others from a button reading its name', () => {
    render(<>{renderBarLeaf({ leaf: margins, name: 'Margins', field: null, row: () => <i>the row form</i> })}</>);
    expect(screen.queryByText('the row form')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Margins' }));
    expect(screen.getByText('the row form')).toBeInTheDocument();
  });

  it('draws a label leaf as its words', () => {
    const label = { kind: 'label', name: 'Stroke', description: '', default: undefined } as PrefLeaf;
    render(<>{renderBarLeaf({ leaf: label, name: 'Stroke', field: null, row: () => <i>the row form</i> })}</>);
    expect(screen.getByText('Stroke')).toBeInTheDocument();
    expect(screen.queryByText('the row form')).toBeNull();
  });

  it('draws nothing where a leaf made of others draws nothing', () => {
    expect(renderBarLeaf({ leaf: margins, name: 'Margins', field: null, row: () => null })).toBeNull();
    expect(withBarLabel(size, undefined)).toBeNull();
  });
});

describe('the panel dispatcher', () => {
  it('draws a leaf in its bar form for a bar', () => {
    const { container } = render(<>{renderBuiltin(panelCtx(size), 'Size', undefined, { surface: 'bar' })}</>);
    expect(screen.getByLabelText('Size')).toBeInTheDocument();
    expect(barLabel(container)).toBe('Size');
  });

  it('draws its row form otherwise', () => {
    const { container } = render(<>{renderBuiltin(panelCtx(size), 'Size')}</>);
    expect(screen.getByLabelText('Size')).toBeInTheDocument();
    expect(barLabel(container)).toBeUndefined();
  });

  it('draws a flag as a switch in a row and a button in a bar', () => {
    const row = render(<>{renderBuiltin(panelCtx(snap), 'Snap')}</>);
    expect(screen.getByRole('switch', { name: 'Snap' })).toBeInTheDocument();
    row.unmount();
    render(<>{renderBuiltin(panelCtx(snap), 'Snap', undefined, { surface: 'bar' })}</>);
    expect(screen.getByRole('button', { name: 'Snap' })).toBeInTheDocument();
  });

  it('opens an object’s rows from a button in a bar', () => {
    render(<>{renderBuiltin(panelCtx(margins), 'Margins', undefined, { surface: 'bar' })}</>);
    expect(screen.queryByLabelText('Top')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Margins' }));
    expect(screen.getByLabelText('Top')).toBeInTheDocument();
  });
});

describe('the form dispatcher', () => {
  it('draws a leaf in its bar form for a bar', () => {
    const { container } = render(<>{renderPrefControl(prefCtx(size), undefined, undefined, 'bar')}</>);
    expect(screen.getByLabelText('Size')).toBeInTheDocument();
    expect(barLabel(container)).toBe('Size');
  });

  it('draws its row form otherwise', () => {
    const { container } = render(<>{renderPrefControl(prefCtx(size), undefined)}</>);
    expect(barLabel(container)).toBeUndefined();
  });

  it('draws a flag the same way the panel does in a bar', () => {
    render(<>{renderPrefControl(prefCtx(snap), undefined, undefined, 'bar')}</>);
    expect(screen.getByRole('button', { name: 'Snap' })).toBeInTheDocument();
  });

  it('leaves a bar leaf to the app’s renderer for its kind', () => {
    const { container } = render(
      <>{renderPrefControl(prefCtx(size), { number: () => <b>custom</b> }, undefined, 'bar')}</>,
    );
    expect(screen.getByText('custom')).toBeInTheDocument();
    expect(barLabel(container)).toBe('Size');
  });
});
