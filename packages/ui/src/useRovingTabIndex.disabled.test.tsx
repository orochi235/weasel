import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRovingTabIndex, type RovingDisabled } from './useRovingTabIndex';
import { Button } from './components/Button';

afterEach(cleanup);

function Row({ disabled, onAction }: { disabled?: RovingDisabled; onAction?: (i: number) => void }) {
  const roving = useRovingTabIndex({ orientation: 'horizontal', ...(disabled ? { disabled } : {}), ...(onAction ? { onAction } : {}) });
  return (
    <div ref={roving.rootRef} onKeyDown={roving.onKeyDown} role="toolbar">
      <Button>Cut</Button>
      <Button disabled disabledReason="Nothing to paste">Paste</Button>
      <Button disabled>Erase</Button>
      <Button>Copy</Button>
    </div>
  );
}

const button = (name: string) => screen.getByRole('button', { name });

/** An arrow from `from`, in keyboard modality, as a user presses it: RAC opens tooltips only on focus-visible. */
function arrow(from: HTMLElement, key = 'ArrowRight') {
  act(() => { fireEvent.keyDown(from, { key }); });
}

describe("useRovingTabIndex's disabled option", () => {
  it("passes over an aria-disabled item by default, as a toolbar's arrows do", () => {
    render(<Row />);
    act(() => button('Cut').focus());
    arrow(button('Cut'));
    expect(document.activeElement).toBe(button('Copy'));
  });

  it("lands on an aria-disabled item under 'stop', and its tooltip says why", () => {
    render(<Row disabled="stop" />);
    act(() => button('Cut').focus());
    arrow(button('Cut'));
    expect(document.activeElement).toBe(button('Paste'));
    expect(screen.getByRole('tooltip').textContent).toContain('Paste: Nothing to paste');
  });

  it("still passes over a natively disabled item under 'stop', which takes no focus", () => {
    render(<Row disabled="stop" />);
    act(() => button('Paste').focus());
    arrow(button('Paste'));
    expect(document.activeElement).toBe(button('Copy'));
  });

  it("steps back onto it the other way under 'stop'", () => {
    render(<Row disabled="stop" />);
    act(() => button('Copy').focus());
    arrow(button('Copy'), 'ArrowLeft');
    expect(document.activeElement).toBe(button('Paste'));
  });

  it('runs no action for an aria-disabled item on Enter', () => {
    const onAction = vi.fn();
    render(<Row disabled="stop" onAction={onAction} />);
    act(() => button('Paste').focus());
    act(() => { fireEvent.keyDown(button('Paste'), { key: 'Enter' }); });
    expect(onAction).not.toHaveBeenCalled();
    act(() => { fireEvent.keyDown(button('Cut'), { key: 'Enter' }); });
    expect(onAction).toHaveBeenCalledWith(0, expect.anything());
  });
});
