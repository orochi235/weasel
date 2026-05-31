import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('renders nothing when isOpen is false', () => {
    render(<Dialog isOpen={false} title="X">body</Dialog>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders title and body when open', () => {
    render(<Dialog isOpen title="Preferences">body content</Dialog>);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Preferences')).toBeTruthy();
    expect(screen.getByText('body content')).toBeTruthy();
  });

  it('uses alertdialog role when requested', () => {
    render(<Dialog isOpen title="Confirm" role="alertdialog">body</Dialog>);
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });

  it('renders the footer slot when provided', () => {
    render(<Dialog isOpen title="X" footer={<button>OK</button>}>body</Dialog>);
    expect(screen.getByRole('button', { name: 'OK' })).toBeTruthy();
  });

  it('shows the close button when onOpenChange is wired and fires it', () => {
    const onOpenChange = vi.fn();
    render(<Dialog isOpen onOpenChange={onOpenChange} title="X">body</Dialog>);
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes via Escape', () => {
    function Wrap() {
      const [open, setOpen] = useState(true);
      return <Dialog isOpen={open} onOpenChange={setOpen} title="X">body</Dialog>;
    }
    render(<Wrap />);
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
