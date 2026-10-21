import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '../Button';
import { Focusable } from './Focusable';
import { Tooltip, TooltipTrigger } from './Tooltip';

/** The console calls react-aria's dev check makes about a `<Focusable>` child.
 *  Spied, not silenced: they still print. */
function focusableWarnings(spy: ReturnType<typeof vi.spyOn>): unknown[][] {
  return spy.mock.calls.filter((args: unknown[]) => String(args[0]).includes('<Focusable>'));
}

describe('Focusable', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  afterEach(() => warn.mockRestore());

  it('does not call a native button mounted hidden unfocusable', () => {
    warn = vi.spyOn(console, 'warn');
    render(
      <div hidden>
        <Button tooltip="Save the document">Save</Button>
      </div>,
    );
    expect(focusableWarnings(warn)).toEqual([]);
  });

  it('does not call a native button under display: none unfocusable', () => {
    warn = vi.spyOn(console, 'warn');
    render(
      <div className="collapsed">
        <style>{'.collapsed { display: none; }'}</style>
        <Button tooltip="Save the document">Save</Button>
      </div>,
    );
    expect(focusableWarnings(warn)).toEqual([]);
  });

  it('still warns about a child with no interactive role', () => {
    warn = vi.spyOn(console, 'warn');
    render(
      <TooltipTrigger>
        <Focusable>
          <span>Save</span>
        </Focusable>
        <Tooltip>Save the document</Tooltip>
      </TooltipTrigger>,
    );
    expect(focusableWarnings(warn)).toEqual([['<Focusable> child must have an interactive ARIA role.']]);
  });

  it('makes a button a tooltip trigger once it is shown', () => {
    warn = vi.spyOn(console, 'warn');
    const { container } = render(
      <div hidden>
        <TooltipTrigger>
          <Focusable>
            <button type="button">Save</button>
          </Focusable>
          <Tooltip>Save the document</Tooltip>
        </TooltipTrigger>
      </div>,
    );
    container.querySelector('div')!.hidden = false;
    const btn = screen.getByRole('button');
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => btn.focus());
    expect(screen.getByRole('tooltip').textContent).toContain('Save the document');
  });
});
