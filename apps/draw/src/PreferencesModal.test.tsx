import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PrefRenderContext } from '@weasel-js/ui/components/Prefs';
import { RegistryEnumControl, SurfacesEditor } from './PreferencesModal';
import { PREFS, type WeaselDrawPrefRegistryEnum } from './prefs';
import { RegistryEnumSourcesContext } from './registry/RegistrySelect';

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
    expect(screen.queryByRole('button', { name: /Show Properties as/ })).toBeNull();
  });
});

describe('RegistryEnumControl', () => {
  const sources = { tools: () => [{ value: 'rect', label: 'Rectangle' }, { value: 'ellipse', label: 'Ellipse' }] };
  const pref = (control?: 'select' | 'radio'): WeaselDrawPrefRegistryEnum => ({
    kind: 'registry-enum', source: 'tools', name: 'Last used tool', description: '', default: 'rect', ...(control ? { control } : {}),
  });
  const ctx = (control: 'select' | 'radio' | undefined, setValue = vi.fn()): PrefRenderContext => ({
    path: 'tools.lastTool', pref: pref(control) as PrefRenderContext['pref'], value: 'rect', setValue, auto: false, setAuto: () => {},
  });

  it('draws radios for a leaf whose control is radio, and its row as a group', () => {
    const setValue = vi.fn();
    render(
      <RegistryEnumSourcesContext.Provider value={sources}>
        <RegistryEnumControl {...ctx('radio', setValue)} />
      </RegistryEnumSourcesContext.Provider>,
    );
    expect(screen.getByRole('radiogroup', { name: 'Last used tool' })).toBeTruthy();
    expect((screen.getByRole('radio', { name: 'Rectangle' }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: 'Ellipse' }));
    expect(setValue).toHaveBeenCalledWith('ellipse');
    expect(typeof RegistryEnumControl.group === 'function' && RegistryEnumControl.group(ctx('radio'))).toBe(true);
  });

  it('keeps the dropdown, in a labeled row, for one naming no control or select', () => {
    for (const control of [undefined, 'select'] as const) {
      const { unmount } = render(
        <RegistryEnumSourcesContext.Provider value={sources}>
          <RegistryEnumControl {...ctx(control)} />
        </RegistryEnumSourcesContext.Provider>,
      );
      expect(screen.queryByRole('radiogroup')).toBeNull();
      expect(screen.getByRole('button', { name: /Last used tool/ })).toBeTruthy();
      expect(typeof RegistryEnumControl.group === 'function' && RegistryEnumControl.group(ctx(control))).toBe(false);
      unmount();
    }
  });
});
