import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PrefRenderContext } from '@weasel-js/ui';
import { PanelsEditor } from './PreferencesModal';
import { PREFS } from './prefs';

function ctxFor(value: unknown, setValue = vi.fn()): PrefRenderContext {
  return {
    path: 'ui.panels',
    pref: PREFS.children.ui.children.panels as PrefRenderContext['pref'],
    value,
    setValue,
    auto: false,
    setAuto: () => {},
  };
}

describe('PanelsEditor', () => {
  it('shows each panel flag from the stored value', () => {
    render(<PanelsEditor ctx={ctxFor({ layers: { collapsed: true } })} />);
    expect((screen.getByLabelText('Collapse Layers panel') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Hide Layers panel') as HTMLInputElement).checked).toBe(false);
  });

  it('writes one flag and keeps the rest of the map', () => {
    const setValue = vi.fn();
    render(<PanelsEditor ctx={ctxFor({ layers: { collapsed: true } }, setValue)} />);
    fireEvent.click(screen.getByLabelText('Hide Layers panel'));
    expect(setValue).toHaveBeenCalledWith({ layers: { collapsed: true, hidden: true } });
  });
});
