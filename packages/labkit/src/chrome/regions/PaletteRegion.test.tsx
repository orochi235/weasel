import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TrialChromeContext, TrialContribution } from '../types';
import { PaletteRegion } from './PaletteRegion';

const Glyph = () => <svg />;

function ctxWith(activeToolId: string | null, setActiveTool = vi.fn()) {
  return { trialId: 't1', activeToolId, setActiveTool } as unknown as TrialChromeContext;
}

function tool(id: string): TrialContribution {
  return { id, region: 'palette', item: { icon: Glyph, label: id } };
}

describe('PaletteRegion', () => {
  it('renders nothing when empty', () => {
    const { container } = render(<PaletteRegion contributions={[]} ctx={ctxWith(null)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('marks the resolved tool as current', () => {
    render(
      <PaletteRegion contributions={[tool('brush'), tool('eraser')]} ctx={ctxWith('brush')} />,
    );
    expect(screen.getByRole('button', { name: 'brush' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'eraser' })).not.toHaveAttribute('aria-current');
  });

  it('sets the tool on click', () => {
    const setActiveTool = vi.fn();
    render(<PaletteRegion contributions={[tool('brush')]} ctx={ctxWith(null, setActiveTool)} />);
    screen.getByRole('button', { name: 'brush' }).click();
    expect(setActiveTool).toHaveBeenCalledWith('brush');
  });

  it('puts exactly one tool in the tab order', () => {
    render(<PaletteRegion contributions={[tool('brush'), tool('eraser')]} ctx={ctxWith(null)} />);
    expect(screen.getByRole('button', { name: 'brush' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: 'eraser' })).toHaveAttribute('tabindex', '-1');
  });

  it('walks the vertical strip with ArrowDown, and leaves ArrowRight to the page', () => {
    render(<PaletteRegion contributions={[tool('brush'), tool('eraser')]} ctx={ctxWith(null)} />);
    const strip = screen.getByRole('toolbar', { name: 'Tools' });
    const brush = screen.getByRole('button', { name: 'brush' });
    const eraser = screen.getByRole('button', { name: 'eraser' });

    brush.focus();
    fireEvent.keyDown(strip, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(eraser);
    expect(eraser).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(strip, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(eraser);
  });
});
