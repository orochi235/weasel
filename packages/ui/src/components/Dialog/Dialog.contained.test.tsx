import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { Button, DialogTrigger } from 'react-aria-components';
import { renderWithIcons } from '../../testing/withIcons';
import { OverlayPortalProvider } from '../../overlays/portalHost';
import { Dialog } from './Dialog';
import { inertOutside } from './ContainedModal';

/** A page with chrome outside a box that stands in for the viewport, the way a workshop holds one story. */
function Page({ open, onOpenChange, keep }: { open: boolean; onOpenChange?: (open: boolean) => void; keep?: (el: Element) => boolean }) {
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
            <Dialog open={open} onOpenChange={onOpenChange} title="Prefs"
              {...(keep ? { dismissable: true, shouldCloseOnInteractOutside: keep } : {})}>
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

  it('closes on a press outside only where shouldCloseOnInteractOutside allows', async () => {
    const onOpenChange = vi.fn();
    const { rerender } = renderWithIcons(<Page open keep={() => false} onOpenChange={onOpenChange} />);
    await userEvent.click(document.querySelector('[data-contained]')!);
    expect(onOpenChange).not.toHaveBeenCalled();
    rerender(<Page open keep={() => true} onOpenChange={onOpenChange} />);
    await userEvent.click(document.querySelector('[data-contained]')!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes from its own close button', () => {
    const onOpenChange = vi.fn();
    renderWithIcons(<Page open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('opens from an enclosing DialogTrigger when given no open', () => {
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

  it('keeps the box inert while a dialog stacked on it stays open after the one under it closes', () => {
    function Stacked({ first, second }: { first: boolean; second: boolean }) {
      const [box, setBox] = useState<HTMLDivElement | null>(null);
      return (
        <div ref={setBox}>
          <div data-testid="story"><button type="button">trigger</button></div>
          {box ? (
            <OverlayPortalProvider container={box} contained>
              <Dialog open={first} title="First"><button type="button">one</button></Dialog>
              <Dialog open={second} title="Second"><button type="button">two</button></Dialog>
            </OverlayPortalProvider>
          ) : null}
        </div>
      );
    }
    const { rerender } = renderWithIcons(<Stacked first second={false} />);
    act(() => rerender(<Stacked first second />));
    act(() => rerender(<Stacked first={false} second />));
    expect(screen.getByTestId('story').hasAttribute('inert')).toBe(true);
    expect(screen.getByRole('dialog', { name: 'Second' }).closest('[inert]')).toBeNull();
    act(() => rerender(<Stacked first={false} second={false} />));
    expect(screen.getByTestId('story').hasAttribute('inert')).toBe(false);
  });
});

describe('inertOutside', () => {
  it('leaves alone what was inert before it', () => {
    const root = document.createElement('div');
    const keep = document.createElement('div');
    const before = document.createElement('div');
    before.setAttribute('inert', '');
    root.append(keep, before);
    inertOutside(root, keep)();
    expect(before.hasAttribute('inert')).toBe(true);
  });
});
