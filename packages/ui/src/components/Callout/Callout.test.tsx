import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useRef, useState } from 'react';
import { Pressable } from 'react-aria-components';
import { Callout, CalloutTrigger } from './Callout';

function TriggerSubject() {
  return (
    <CalloutTrigger>
      <Pressable>
        <button type="button">Explain</button>
      </Pressable>
      <Callout title="Heads up">Body text</Callout>
    </CalloutTrigger>
  );
}

function ProgrammaticSubject(props: { modal?: boolean; onOutsideClick?: () => void }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(true);
  return (
    <>
      <div ref={anchor}>anchor</div>
      <button type="button" onClick={props.onOutsideClick}>outside</button>
      <Callout
        triggerRef={anchor}
        isOpen={open}
        onOpenChange={setOpen}
        modal={props.modal}
        title="Note"
      >
        Pointed content
      </Callout>
    </>
  );
}

describe('Callout', () => {
  it('opens from a composed trigger and closes via the close button', () => {
    render(<TriggerSubject />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Body text')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close callout' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('supports programmatic triggerRef + controlled open', () => {
    render(<ProgrammaticSubject />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Pointed content')).toBeTruthy();
  });

  it('closes on Escape when non-modal', () => {
    render(<ProgrammaticSubject />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('uses alertdialog role and hides outside content when modal', () => {
    render(<ProgrammaticSubject modal />);
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    // react-aria's ariaHideOutside removes outside content from the a11y
    // tree while a modal overlay is open.
    expect(screen.queryByRole('button', { name: 'outside' })).toBeNull();
  });

  it('renders an invisible fixed anchor for anchorRect mode', () => {
    render(
      <Callout isOpen anchorRect={{ x: 120, y: 80, width: 40, height: 20 }} title="Here">
        Anchored
      </Callout>,
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    const anchor = document.body.querySelector('[data-callout-anchor]') as HTMLElement;
    expect(anchor).toBeTruthy();
    expect(anchor.style.left).toBe('120px');
    expect(anchor.style.top).toBe('80px');
    expect(anchor.style.width).toBe('40px');
    expect(anchor.style.height).toBe('20px');
  });

  it('applies the tone class', () => {
    render(
      <Callout isOpen anchorRect={{ x: 0, y: 0, width: 10, height: 10 }} tone="danger">
        !
      </Callout>,
    );
    const popover = screen.getByRole('dialog').closest('[class*="popover"]');
    expect(popover?.className).toMatch(/toneDanger/);
  });
});
