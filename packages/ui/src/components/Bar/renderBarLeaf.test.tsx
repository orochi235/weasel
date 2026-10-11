import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { PrefLeaf } from '@weasel-js/prefs';
import { renderPrefControl, type PrefRenderContext } from '../Prefs/PrefsRow';
import { renderBuiltin, type PropertyRenderContext } from '../SelectionPanel/renderLeaf';
import { renderBarLeaf, withBarLabel } from './renderBarLeaf';

const size: PrefLeaf = { kind: 'number', name: 'Size', description: 'Type size.', default: 12 };
const align: PrefLeaf = {
  kind: 'enum',
  name: 'Align',
  description: 'Where the line sits.',
  default: 'left',
  control: 'select',
  options: [
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
  ],
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
  it('sets a value box behind its name', () => {
    const { container } = render(<>{renderBarLeaf({ leaf: size, row: () => <input aria-label="Size" /> })}</>);
    expect(barLabel(container)).toBe('Size');
    expect(container.querySelector('[data-bar-label]')).toHaveAttribute('aria-hidden', 'true');
  });

  it('leaves a control that names itself bare', () => {
    const { container } = render(<>{renderBarLeaf({ leaf: align, row: () => <select aria-label="Align" /> })}</>);
    expect(barLabel(container)).toBeUndefined();
  });

  it('draws nothing where the leaf draws nothing', () => {
    expect(renderBarLeaf({ leaf: size, row: () => null })).toBeNull();
    expect(withBarLabel(size, undefined)).toBeNull();
  });
});

describe('the panel dispatcher', () => {
  it('draws a leaf in its bar form for a bar', () => {
    const { container, getByLabelText } = render(
      <>{renderBuiltin(panelCtx(size), 'Size', undefined, { surface: 'bar' })}</>,
    );
    expect(getByLabelText('Size')).toBeInTheDocument();
    expect(barLabel(container)).toBe('Size');
  });

  it('draws its row form otherwise', () => {
    const { container, getByLabelText } = render(<>{renderBuiltin(panelCtx(size), 'Size')}</>);
    expect(getByLabelText('Size')).toBeInTheDocument();
    expect(barLabel(container)).toBeUndefined();
  });
});

describe('the form dispatcher', () => {
  it('draws a leaf in its bar form for a bar', () => {
    const { container, getByLabelText } = render(<>{renderPrefControl(prefCtx(size), undefined, undefined, 'bar')}</>);
    expect(getByLabelText('Size')).toBeInTheDocument();
    expect(barLabel(container)).toBe('Size');
  });

  it('draws its row form otherwise', () => {
    const { container } = render(<>{renderPrefControl(prefCtx(size), undefined)}</>);
    expect(barLabel(container)).toBeUndefined();
  });

  it('leaves a bar leaf to the app’s renderer for its kind', () => {
    const { container, getByText } = render(
      <>{renderPrefControl(prefCtx(size), { number: () => <b>custom</b> }, undefined, 'bar')}</>,
    );
    expect(getByText('custom')).toBeInTheDocument();
    expect(barLabel(container)).toBe('Size');
  });
});
