import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it, vi } from 'vitest';
import { icon } from '../../icons.gen';
import type { RegionContribution, ToolSlotContext } from '../types';
import { PaletteRegion } from './PaletteRegion';

const Glyph = icon('ui:add');

// The region reads a tool slot and nothing else, so the fixture is a real
// `ToolSlotContext` rather than a faked trial.
function ctxWith(activeToolId: string | null, setActiveTool = vi.fn()): ToolSlotContext {
  return { activeToolId, setActiveTool };
}

function tool(id: string): RegionContribution<ToolSlotContext> {
  return { id, region: 'palette', item: { icon: Glyph, label: id } };
}

describe('PaletteRegion', () => {
  it('renders nothing when empty', () => {
    const { container } = renderWithIcons(<PaletteRegion contributions={[]} ctx={ctxWith(null)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('marks the resolved tool as current', () => {
    renderWithIcons(
      <PaletteRegion contributions={[tool('brush'), tool('eraser')]} ctx={ctxWith('brush')} />,
    );
    expect(screen.getByRole('button', { name: 'brush' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'eraser' })).not.toHaveAttribute('aria-current');
  });

  it('keeps a group together where it first appears, as every region does', () => {
    const grouped = (id: string, group: string) => ({ ...tool(id), group });
    renderWithIcons(
      <PaletteRegion
        contributions={[
          grouped('brush', 'paint'),
          grouped('select', 'pick'),
          grouped('fill', 'paint'),
        ]}
        ctx={ctxWith(null)}
      />,
    );
    expect(
      screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent),
    ).toEqual(['brush', 'fill', 'select']);
  });

  it('sets the tool on click', () => {
    const setActiveTool = vi.fn();
    renderWithIcons(
      <PaletteRegion contributions={[tool('brush')]} ctx={ctxWith(null, setActiveTool)} />,
    );
    screen.getByRole('button', { name: 'brush' }).click();
    expect(setActiveTool).toHaveBeenCalledWith('brush');
  });

  it('runs a command instead of writing the tool slot, and never marks it current', () => {
    const onActivate = vi.fn();
    const setActiveTool = vi.fn();
    const ctx = ctxWith('info', setActiveTool);
    const info: RegionContribution<ToolSlotContext> = {
      id: 'info',
      region: 'palette',
      item: { icon: Glyph, label: 'Info', onActivate },
    };
    renderWithIcons(<PaletteRegion contributions={[info]} ctx={ctx} />);
    const button = screen.getByRole('button', { name: 'Info' });
    button.click();
    expect(onActivate).toHaveBeenCalledWith(ctx);
    expect(setActiveTool).not.toHaveBeenCalled();
    // The slot names this id, and a command still must not read as held down.
    expect(button).not.toHaveAttribute('aria-current');
  });

  it('puts exactly one tool in the tab order', () => {
    renderWithIcons(
      <PaletteRegion contributions={[tool('brush'), tool('eraser')]} ctx={ctxWith(null)} />,
    );
    expect(screen.getByRole('button', { name: 'brush' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: 'eraser' })).toHaveAttribute('tabindex', '-1');
  });

  it('walks the vertical strip with ArrowDown, and leaves ArrowRight to the page', () => {
    renderWithIcons(
      <PaletteRegion contributions={[tool('brush'), tool('eraser')]} ctx={ctxWith(null)} />,
    );
    const brush = screen.getByRole('button', { name: 'brush' });
    const eraser = screen.getByRole('button', { name: 'eraser' });

    act(() => brush.focus());
    fireEvent.keyDown(brush, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(eraser);
    expect(eraser).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(eraser, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(eraser);
  });

  it('latches a command while it is pressed, without writing the tool slot', () => {
    const setActiveTool = vi.fn();
    const onActivate = vi.fn();
    renderWithIcons(
      <PaletteRegion
        contributions={[
          {
            id: 'grid',
            region: 'palette',
            item: { icon: Glyph, label: 'Grid', pressed: true, onActivate },
          },
          { id: 'snap', region: 'palette', item: { icon: Glyph, label: 'Snap', onActivate } },
        ]}
        ctx={ctxWith(null, setActiveTool)}
      />,
    );
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Snap' })).not.toHaveAttribute('aria-current');
    screen.getByRole('button', { name: 'Grid' }).click();
    expect(onActivate).toHaveBeenCalledOnce();
    expect(setActiveTool).not.toHaveBeenCalled();
  });

  it('keeps a disabled tool with a reason reachable, and says why', () => {
    renderWithIcons(
      <PaletteRegion
        contributions={[
          {
            id: 'pen',
            region: 'palette',
            item: { icon: Glyph, label: 'Pen', disabled: true, disabledReason: 'Locked' },
          },
        ]}
        ctx={ctxWith(null)}
      />,
    );
    const pen = screen.getByRole('button', { name: 'Pen' });
    expect(pen).toHaveAttribute('aria-disabled', 'true');
    expect(pen).toHaveAttribute('aria-description', 'Locked');
  });
});
