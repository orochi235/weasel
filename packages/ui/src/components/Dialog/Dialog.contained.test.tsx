import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { Button, DialogTrigger } from 'react-aria-components';
import { renderWithIcons } from '../../testing/withIcons';
import { OverlayPortalProvider } from '../../overlays/portalHost';
import { Dialog } from './Dialog';

/** A page with chrome outside a box that stands in for the viewport, the way a workshop holds one story. */
function Page({ open, onOpenChange }: { open: boolean; onOpenChange?: (open: boolean) => void }) {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  return (
    <>
      <button type="button">chrome</button>
      <div ref={setBox} data-testid="box">
        <div data-testid="story">
          <button type="button">trigger</button>
        </div>
        {box ? (
          <OverlayPortalProvider container={box} contained>
            <Dialog isOpen={open} onOpenChange={onOpenChange} title="Prefs">
              <button type="button">inside</button>
            </Dialog>
          </OverlayPortalProvider>
        ) : null}
      </div>
    </>
  );
}

describe('Dialog in a contained portal', () => {
  it('portals into the box, and makes inert what the box holds but nothing outside it', () => {
    renderWithIcons(<Page open />);
    const dialog = screen.getByRole('dialog', { name: 'Prefs' });
    expect(screen.getByTestId('box')).toContainElement(dialog);
    expect(screen.getByTestId('story').hasAttribute('inert')).toBe(true);
    expect(screen.getByRole('button', { name: 'chrome', hidden: true }).closest('[inert]')).toBeNull();
    expect(document.querySelectorAll('[aria-hidden="true"]:not(svg)')).toHaveLength(0);
    expect(dialog.closest('[inert]')).toBeNull();
  });

  it('leaves the page free to scroll', () => {
    renderWithIcons(<Page open />);
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.body.style.overflow).toBe('');
  });

  it('closes on Escape and gives the box back', () => {
    const onOpenChange = vi.fn();
    const { rerender } = renderWithIcons(<Page open onOpenChange={onOpenChange} />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'inside' }), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    act(() => rerender(<Page open={false} onOpenChange={onOpenChange} />));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('story').hasAttribute('inert')).toBe(false);
  });

  it('closes from its own close button', () => {
    const onOpenChange = vi.fn();
    renderWithIcons(<Page open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('opens from an enclosing DialogTrigger when given no isOpen', () => {
    function Triggered() {
      const [box, setBox] = useState<HTMLDivElement | null>(null);
      return (
        <div ref={setBox}>
          {box ? (
            <OverlayPortalProvider container={box} contained>
              <DialogTrigger>
                <Button>open</Button>
                <Dialog title="Prefs"><button type="button">inside</button></Dialog>
              </DialogTrigger>
            </OverlayPortalProvider>
          ) : null}
        </div>
      );
    }
    renderWithIcons(<Triggered />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    expect(screen.getByRole('dialog', { name: 'Prefs' })).toBeTruthy();
  });
});
