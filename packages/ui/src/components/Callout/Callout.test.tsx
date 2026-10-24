import { cssColorLiteral } from '@weasel-js/paint';
import { describe, it, expect, vi } from 'vitest';
import { act, screen, fireEvent } from '@testing-library/react';
import { useRef, useState } from 'react';
import { Pressable } from 'react-aria-components';
import { renderThenAbandon } from '@weasel-js/react/testing/abandonRender';
import { Callout, CalloutTrigger } from './Callout';
import { renderWithIcons, withIcons as WithIcons } from '../../testing/withIcons';

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
    renderWithIcons(<TriggerSubject />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Body text')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close callout' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('supports programmatic triggerRef + controlled open', () => {
    renderWithIcons(<ProgrammaticSubject />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Pointed content')).toBeTruthy();
  });

  it('closes on Escape when non-modal', () => {
    renderWithIcons(<ProgrammaticSubject />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('uses alertdialog role and hides outside content when modal', () => {
    renderWithIcons(<ProgrammaticSubject modal />);
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    // react-aria's ariaHideOutside removes outside content from the a11y
    // tree while a modal overlay is open.
    expect(screen.queryByRole('button', { name: 'outside' })).toBeNull();
  });

  it('renders an invisible fixed anchor for anchorRect mode', () => {
    renderWithIcons(
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

  it('moves its anchor, and changes its width by under a pixel so RAC repositions, when anchorRect moves', () => {
    // RAC's ResizeObserver on the anchor is what repositions the popover, and jsdom has none: the width change
    // is a proxy for it here, and Callout.reanchor.browser.test.tsx watches the popover follow.
    const onResize = vi.fn();
    window.addEventListener('resize', onResize);
    const at = (x: number, y: number) => (
      <Callout isOpen anchorRect={{ x, y, width: 40, height: 20 }} title="Here">Anchored</Callout>
    );
    const { rerender } = renderWithIcons(at(10, 10));
    const anchor = document.body.querySelector('[data-callout-anchor]') as HTMLElement;
    const widths = [anchor.style.width];
    rerender(at(90, 60));
    expect(anchor.style.left).toBe('90px');
    expect(anchor.style.top).toBe('60px');
    widths.push(anchor.style.width);
    rerender(at(120, 60));
    widths.push(anchor.style.width);
    expect(widths[1]).not.toBe(widths[0]);
    expect(widths[2]).not.toBe(widths[1]);
    for (const w of widths) expect(Math.abs(parseFloat(w) - 40)).toBeLessThan(0.1);
    expect(onResize).not.toHaveBeenCalled();
    window.removeEventListener('resize', onResize);
  });

  it('leaves the anchor as it is when the anchor rect is unchanged', () => {
    const rect = { x: 10, y: 10, width: 40, height: 20 };
    const { rerender } = renderWithIcons(
      <Callout isOpen anchorRect={rect} title="Here">Anchored</Callout>,
    );
    const anchor = document.body.querySelector('[data-callout-anchor]') as HTMLElement;
    const before = anchor.style.width;
    // New object, same numbers: the nudge keys on the values, not identity.
    rerender(<Callout isOpen anchorRect={{ ...rect }} title="Here">Anchored</Callout>);
    expect(anchor.style.width).toBe(before);
  });

  it('carries a tint beside the popover’s own positioning', () => {
    renderWithIcons(
      <Callout isOpen anchorRect={{ x: 0, y: 0, width: 10, height: 10 }} tint={cssColorLiteral('#224a63')} aria-label="Tinted">
        !
      </Callout>,
    );
    const popover = screen.getByRole('dialog').parentElement!;
    expect(popover.dataset.grade).toBe('warn');
    expect(popover.style.getPropertyValue('--wzl-tint')).toBe('#224a63');
    expect(popover.style.position).not.toBe('');
  });

  it('names its grade, `warn` unless told otherwise', () => {
    renderWithIcons(
      <Callout
        isOpen
        anchorRect={{ x: 0, y: 0, width: 10, height: 10 }}
        grade="danger"
        aria-label="Danger callout"
      >
        !
      </Callout>,
    );
    const popover = screen.getByRole('dialog').parentElement;
    expect(popover?.dataset.grade).toBe('danger');
  });

  it('closes via the close button in programmatic triggerRef mode (close() no-op fallback)', () => {
    renderWithIcons(<ProgrammaticSubject />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close callout' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('blocks outside-click dismissal when modal', () => {
    renderWithIcons(<ProgrammaticSubject modal />);
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    // useInteractOutside needs the full pointer cycle (down, up, then the
    // resulting click) to register as an outside interaction in jsdom.
    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(document.body);
    fireEvent.click(document.body);
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });

  it('defaults to no close button when modal', () => {
    renderWithIcons(<ProgrammaticSubject modal />);
    expect(screen.queryByRole('button', { name: 'Close callout' })).toBeNull();
  });

  it('renders the footer slot', () => {
    renderWithIcons(<ProgrammaticSubject footer={<button type="button">Footer action</button>} />);
    expect(screen.getByRole('button', { name: 'Footer action' })).toBeTruthy();
  });

  it('reports the close button as a dismissal', () => {
    const onDismiss = vi.fn();
    renderWithIcons(<ProgrammaticSubject onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close callout' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('reports Escape as a dismissal', () => {
    const onDismiss = vi.fn();
    renderWithIcons(<ProgrammaticSubject onDismiss={onDismiss} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('reports Escape to the committed onDismiss, not an abandoned render\'s', async () => {
    const committed = vi.fn();
    const abandoned = vi.fn();
    renderThenAbandon(committed, abandoned, (onDismiss) => (
      <WithIcons><ProgrammaticSubject onDismiss={onDismiss} /></WithIcons>
    ));
    await act(async () => { fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' }); });
    expect(abandoned).not.toHaveBeenCalled();
    expect(committed).toHaveBeenCalledTimes(1);
  });

  it('does not report interaction or focus leaving as a dismissal', () => {
    // The distinction onDismiss exists for: a non-modal popover gives up on
    // interaction and focus leaving it, which on a canvas is every click on
    // the artwork. A consumer that owns dismissal must not hear those as "the
    // user read this and waved it away".
    const onDismiss = vi.fn();
    renderWithIcons(<ProgrammaticSubject onDismiss={onDismiss} />);
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
    renderWithIcons(
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
    renderWithIcons(<Subject />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(document.body.querySelector('[data-callout-anchor]')).toBeTruthy();
  });
});
