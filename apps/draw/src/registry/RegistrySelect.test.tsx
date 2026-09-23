import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RegistryEnumSourcesContext, RegistrySelect } from './RegistrySelect';

const sources = {
  tools: () => [
    { value: 'rect', label: 'Rectangle' },
    { value: 'ellipse', label: 'Ellipse' },
  ],
};

function open(value: string, onChange = vi.fn()) {
  render(
    <RegistryEnumSourcesContext.Provider value={sources}>
      <RegistrySelect value={value} onChange={onChange} source="tools" aria-label="Tool" />
    </RegistryEnumSourcesContext.Provider>,
  );
  fireEvent.click(screen.getByRole('button', { name: /Tool/ }));
  return onChange;
}

describe('RegistrySelect', () => {
  it('lists the registry sorted by label and picks from it', () => {
    const onChange = open('rect');
    const names = screen.getAllByRole('option').map((o) => o.textContent);
    expect(names).toEqual(['Ellipse', 'Rectangle']);
    fireEvent.click(screen.getByRole('option', { name: 'Ellipse' }));
    expect(onChange).toHaveBeenCalledWith('ellipse');
  });

  it('keeps a stored value missing from the registry as a disabled option', () => {
    open('gone');
    const stale = screen.getByRole('option', { name: 'gone (not in registry)' });
    expect(stale.getAttribute('aria-disabled')).toBe('true');
  });

  it('falls back to a text field when no resolver is wired', () => {
    const onChange = vi.fn();
    render(<RegistrySelect value="rect" onChange={onChange} source="missing" aria-label="Tool" />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Tool' }), { target: { value: 'star' } });
    expect(onChange).toHaveBeenCalledWith('star');
  });
});
