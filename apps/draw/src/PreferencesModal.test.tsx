import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PrefRenderContext } from '@weasel-js/ui';
import { SurfacesEditor } from './PreferencesModal';
import { PREFS } from './prefs';

function ctxFor(value: unknown, setValue = vi.fn()): PrefRenderContext {
  return {
    path: 'ui.surfaces',
    pref: PREFS.children.ui.children.surfaces as PrefRenderContext['pref'],
    value,
    setValue,
    auto: false,
    setAuto: () => {},
  };
}

describe('SurfacesEditor', () => {
  it('shows each panel flag from the stored value', () => {
    render(<SurfacesEditor ctx={ctxFor({ layers: { collapsed: true } })} />);
    expect((screen.getByLabelText('Collapse Layers') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Hide Layers') as HTMLInputElement).checked).toBe(false);
  });

  it('writes one flag and keeps the rest of the map', () => {
    const setValue = vi.fn();
    render(<SurfacesEditor ctx={ctxFor({ layers: { collapsed: true } }, setValue)} />);
    fireEvent.click(screen.getByLabelText('Hide Layers'));
    expect(setValue).toHaveBeenCalledWith({ layers: { collapsed: true, hidden: true } });
  });

  it('lists the chrome that is not a surface asset, with a hidden flag and no collapsed one', () => {
    const setValue = vi.fn();
    render(<SurfacesEditor ctx={ctxFor({ statusBar: { hidden: true } }, setValue)} />);
    expect((screen.getByLabelText('Hide Status bar') as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByLabelText('Collapse Status bar')).toBeNull();
    fireEvent.click(screen.getByLabelText('Hide Tools'));
    expect(setValue).toHaveBeenCalledWith({ statusBar: { hidden: true }, tools: { hidden: true } });
  });

  it('offers a surface choice only for an asset that allows more than one', () => {
    render(<SurfacesEditor ctx={ctxFor({ path: { surface: 'menu' } })} />);
    expect(screen.getByRole('button', { name: /Show Path as/ }).textContent).toMatch(/Menu/);
    expect(screen.queryByRole('button', { name: /Show Layers as/ })).toBeNull();
  });
});
