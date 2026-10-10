import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Palette } from './Palette';

afterEach(cleanup);

const tools = () => within(screen.getByRole('group', { name: 'Drag to add' })).getAllByRole('button');

describe('Palette', () => {
  it('draws each thing it makes as a tool button: a glyph over its name', () => {
    render(<Palette onDrag={vi.fn()} onDrop={vi.fn()} />);
    expect(tools().map((b) => b.textContent)).toEqual(['Page', 'Tab', 'Panel', 'Section', 'Label']);
    for (const button of tools()) expect(button.querySelector('svg')).not.toBeNull();
  });

  it('offers no page under a section root', () => {
    render(<Palette sections onDrag={vi.fn()} onDrop={vi.fn()} />);
    expect(tools().map((b) => b.textContent)).toEqual(['Tab', 'Panel', 'Section', 'Label']);
  });

  it('reports a drag from a button as it moves, and the node it made where it is let go', () => {
    const onDrag = vi.fn();
    const onDrop = vi.fn();
    render(<Palette onDrag={onDrag} onDrop={onDrop} />);
    const panel = screen.getByRole('button', { name: 'Panel' });
    fireEvent.pointerDown(panel, { button: 0, clientX: 5, clientY: 5 });
    fireEvent.pointerMove(panel, { clientX: 40, clientY: 60 });
    expect(onDrag).toHaveBeenLastCalledWith(expect.objectContaining({ x: 40, y: 60, node: expect.objectContaining({ as: 'panel' }) }));
    fireEvent.pointerUp(panel, { clientX: 50, clientY: 70 });
    expect(onDrop).toHaveBeenCalledWith(expect.objectContaining({ x: 50, y: 70, node: expect.objectContaining({ as: 'panel' }) }));
    expect(onDrag).toHaveBeenLastCalledWith(null);
  });

  it('drops nothing when Escape ends the drag', () => {
    const onDrag = vi.fn();
    const onDrop = vi.fn();
    render(<Palette onDrag={onDrag} onDrop={onDrop} />);
    const panel = screen.getByRole('button', { name: 'Panel' });
    fireEvent.pointerDown(panel, { button: 0, clientX: 5, clientY: 5 });
    fireEvent.pointerMove(panel, { clientX: 40, clientY: 60 });
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(onDrag).toHaveBeenLastCalledWith(null);
    fireEvent.pointerUp(panel, { clientX: 50, clientY: 70 });
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('makes nothing of a press that never moves', () => {
    const onDrag = vi.fn();
    const onDrop = vi.fn();
    render(<Palette onDrag={onDrag} onDrop={onDrop} />);
    const panel = screen.getByRole('button', { name: 'Panel' });
    fireEvent.pointerDown(panel, { button: 0, clientX: 5, clientY: 5 });
    fireEvent.pointerUp(panel, { clientX: 5, clientY: 5 });
    expect(onDrag).not.toHaveBeenCalled();
    expect(onDrop).not.toHaveBeenCalled();
  });
});
