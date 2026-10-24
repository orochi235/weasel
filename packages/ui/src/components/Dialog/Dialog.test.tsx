import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '../../testing/withIcons';
import { useState } from 'react';
import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('renders nothing when isOpen is false', () => {
    renderWithIcons(<Dialog isOpen={false} title="X">body</Dialog>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders title and body when open', () => {
    renderWithIcons(<Dialog isOpen title="Preferences">body content</Dialog>);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Preferences')).toBeTruthy();
    expect(screen.getByText('body content')).toBeTruthy();
  });

  it('puts its grade and tint on the modal box', () => {
    renderWithIcons(<Dialog isOpen title="Delete" grade="danger" tint={0} role="alertdialog">body</Dialog>);
    const modal = screen.getByRole('alertdialog').parentElement!;
    expect(modal.dataset.grade).toBe('danger');
    expect(modal.style.getPropertyValue('--wzl-tint')).toBe('var(--wzl-swatch-fuchsia)');
  });

  it('draws inline where it is rendered, whatever isOpen says, with its close reporting through onOpenChange', () => {
    const onOpenChange = vi.fn();
    const { container } = renderWithIcons(
      <div data-testid="host">
        <Dialog inline isOpen={false} onOpenChange={onOpenChange} title="Preview" footer={<span>foot</span>}>body</Dialog>
      </div>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Preview' });
    expect(screen.getByTestId('host')).toContainElement(dialog);
    expect(container.querySelector('[data-weasel-overlay]')).toBeNull();
    expect(screen.getByText('foot')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders the footer slot when provided', () => {
    renderWithIcons(<Dialog isOpen title="X" footer={<button>OK</button>}>body</Dialog>);
    expect(screen.getByRole('button', { name: 'OK' })).toBeTruthy();
  });

  it('shows the close button when onOpenChange is wired and fires it', () => {
    const onOpenChange = vi.fn();
    renderWithIcons(<Dialog isOpen onOpenChange={onOpenChange} title="X">body</Dialog>);
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes via Escape', () => {
    function Wrap() {
      const [open, setOpen] = useState(true);
      return <Dialog isOpen={open} onOpenChange={setOpen} title="X">body</Dialog>;
    }
    renderWithIcons(<Wrap />);
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
