import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextDomDemo } from '../TextDomDemo';

const overlay = () => document.querySelector<HTMLElement>('[contenteditable]');

describe('TextDomDemo', () => {
  it('opens an editable overlay seeded with the styled runs', () => {
    render(<TextDomDemo />);
    expect(overlay()).toBeNull();
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Edit' })); });
    const el = overlay();
    expect(el?.textContent).toBe('Edit this line in place');
    expect(el?.querySelectorAll('[data-run]').length).toBe(3);
  });

  it('writes the edited text back as runs on Enter', () => {
    render(<TextDomDemo />);
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Edit' })); });
    const el = overlay()!;
    el.querySelectorAll('[data-run]')[2]!.textContent = ' line, edited';
    act(() => { fireEvent.keyDown(el, { key: 'Enter' }); });
    expect(overlay()).toBeNull();
    const runs = within(screen.getByRole('list', { name: 'runs' })).getAllByRole('listitem');
    expect(runs.map((r) => r.querySelector('code')?.textContent)).toEqual(['"Edit "', '"this"', '" line, edited"']);
    expect(runs[1]!.textContent).toContain('bold');
  });
});
