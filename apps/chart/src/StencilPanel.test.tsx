import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FLOWCHART_STENCILS } from '@weasel-js/diagram';
import { StencilPanel } from './StencilPanel';
import { STENCIL_MIME } from './stencilDrop';

afterEach(cleanup);

describe('StencilPanel', () => {
  it('lists every flowchart stencil under "Shapes"', () => {
    render(<StencilPanel active={null} setActive={() => {}} />);
    expect(screen.getByText('Shapes')).toBeTruthy();
    const rows = screen.getAllByRole('option');
    expect(rows.map((r) => r.textContent)).toEqual(FLOWCHART_STENCILS.map((s) => s.label));
  });

  it("activates a row's stencil tool", () => {
    const setActive = vi.fn();
    render(<StencilPanel active={null} setActive={setActive} />);
    fireEvent.click(screen.getByRole('option', { name: 'Decision' }));
    expect(setActive).toHaveBeenCalledWith('stencil:decision');
  });

  it('marks the active stencil selected', () => {
    render(<StencilPanel active="stencil:terminal" setActive={() => {}} />);
    expect(screen.getByRole('option', { name: 'Terminal' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('option', { name: 'Process' }).getAttribute('aria-selected')).toBe('false');
  });

  it('carries the stencil id on a drag', () => {
    render(<StencilPanel active={null} setActive={() => {}} />);
    const row = screen.getByRole('option', { name: 'Data' });
    expect(row.getAttribute('draggable')).toBe('true');
    const data = new Map<string, string>();
    fireEvent.dragStart(row, { dataTransfer: { setData: (t: string, v: string) => data.set(t, v), effectAllowed: '' } });
    expect(data.get(STENCIL_MIME)).toBe('data');
  });
});
