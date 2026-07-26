import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useRef, useState } from 'react';
import { Pressable } from 'react-aria-components';
import { Callout, CalloutTrigger } from './Callout';
import s from './Callout.module.css';

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

function ProgrammaticSubject(props: {
  modal?: boolean;
  onOutsideClick?: () => void;
  footer?: React.ReactNode;
  onDismiss?: () => void;
}) {
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
        footer={props.footer}
        onDismiss={props.onDismiss}
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

  it('moves its anchor and asks RAC to reposition when anchorRect changes', () => {
    // A consumer tracking a scene node recomputes the rect on pan/zoom. RAC
    // recomputes overlay position on window resize, so the re-anchor rides on
    // that; without the nudge a pure translation leaves the popover behind
    // (the anchor's ResizeObserver only fires when its *size* changes).
    const onResize = vi.fn();
    window.addEventListener('resize', onResize);
    const { rerender } = render(
      <Callout isOpen anchorRect={{ x: 10, y: 10, width: 40, height: 20 }} title="Here">
        Anchored
      </Callout>,
    );
    onResize.mockClear();

    rerender(
      <Callout isOpen anchorRect={{ x: 90, y: 60, width: 40, height: 20 }} title="Here">
        Anchored
      </Callout>,
    );

    const anchor = document.body.querySelector('[data-callout-anchor]') as HTMLElement;
    expect(anchor.style.left).toBe('90px');
    expect(anchor.style.top).toBe('60px');
    expect(onResize).toHaveBeenCalled();
    window.removeEventListener('resize', onResize);
  });

  it('does not nudge when the anchor rect is unchanged', () => {
    const rect = { x: 10, y: 10, width: 40, height: 20 };
    const onResize = vi.fn();
    window.addEventListener('resize', onResize);
    const { rerender } = render(
      <Callout isOpen anchorRect={rect} title="Here">Anchored</Callout>,
    );
    onResize.mockClear();
    // New object, same numbers — the effect keys on the values, not identity.
    rerender(<Callout isOpen anchorRect={{ ...rect }} title="Here">Anchored</Callout>);
    expect(onResize).not.toHaveBeenCalled();
    window.removeEventListener('resize', onResize);
  });

  it('applies the tone class', () => {
    render(
      <Callout
        isOpen
        anchorRect={{ x: 0, y: 0, width: 10, height: 10 }}
        tone="danger"
        aria-label="Danger callout"
      >
        !
      </Callout>,
    );
    const popover = screen.getByRole('dialog').parentElement;
    expect(popover?.classList.contains(s.toneDanger)).toBe(true);
  });

  it('closes via the close button in programmatic triggerRef mode (close() no-op fallback)', () => {
    render(<ProgrammaticSubject />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close callout' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('blocks outside-click dismissal when modal', () => {
    render(<ProgrammaticSubject modal />);
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    // useInteractOutside needs the full pointer cycle (down, up, then the
    // resulting click) to register as an outside interaction in jsdom.
    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(document.body);
    fireEvent.click(document.body);
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });

  it('defaults to no close button when modal', () => {
    render(<ProgrammaticSubject modal />);
    expect(screen.queryByRole('button', { name: 'Close callout' })).toBeNull();
  });

  it('renders the footer slot', () => {
    render(<ProgrammaticSubject footer={<button type="button">Footer action</button>} />);
    expect(screen.getByRole('button', { name: 'Footer action' })).toBeTruthy();
  });

  it('reports the close button as a dismissal', () => {
    const onDismiss = vi.fn();
    render(<ProgrammaticSubject onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close callout' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('reports Escape as a dismissal', () => {
    const onDismiss = vi.fn();
    render(<ProgrammaticSubject onDismiss={onDismiss} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not report interaction or focus leaving as a dismissal', () => {
    // The distinction onDismiss exists for: a non-modal popover gives up on
    // interaction and focus leaving it, which on a canvas is every click on
    // the artwork. A consumer that owns dismissal must not hear those as "the
    // user read this and waved it away".
    const onDismiss = vi.fn();
    render(<ProgrammaticSubject onDismiss={onDismiss} />);
    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(document.body);
    fireEvent.click(document.body);
    fireEvent.focusOut(screen.getByRole('dialog'));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('leaves a pinned-open callout up until it is dismissed', () => {
    // The shape a consumer owning dismissal uses: isOpen stays true while the
    // message stands, so RAC's own close paths can't retire it early.
    const onDismiss = vi.fn();
    render(
      <Callout isOpen anchorRect={{ x: 0, y: 0, width: 10, height: 10 }} title="Note" onDismiss={onDismiss}>
        Pinned
      </Callout>,
    );
    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(document.body);
    fireEvent.click(document.body);
    fireEvent.focusOut(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Close callout' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('prefers anchorRect over triggerRef when both are provided', () => {
    const anchor = { x: 5, y: 5, width: 5, height: 5 };
    function Subject() {
      const triggerRef = useRef<HTMLDivElement>(null);
      return (
        <>
          <div ref={triggerRef}>trigger</div>
          <Callout
            isOpen
            triggerRef={triggerRef}
            anchorRect={anchor}
            aria-label="Both anchors"
          >
            Content
          </Callout>
        </>
      );
    }
    render(<Subject />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(document.body.querySelector('[data-callout-anchor]')).toBeTruthy();
  });
});
