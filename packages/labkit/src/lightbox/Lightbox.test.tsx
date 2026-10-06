import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Lightbox } from './Lightbox';
import { useLightboxControl } from './LightboxContext';

function root(): HTMLElement {
  return document.querySelector('.lk-lightbox') as HTMLElement;
}

const expanded = (): boolean => root().classList.contains('lk-lightbox--expanded');

describe('Lightbox', () => {
  it('does not open on a double-click unless asked to', () => {
    render(
      <Lightbox>
        <div data-testid="out">output</div>
      </Lightbox>,
    );
    fireEvent.doubleClick(screen.getByTestId('out'));
    expect(expanded()).toBe(false);
    expect(screen.getByRole('button', { name: 'Expand' })).toBeInTheDocument();
  });

  it('opens on a double-click on its content when asked to, and closes on another', () => {
    render(
      <Lightbox expandOnDoubleClick>
        <div data-testid="out">output</div>
      </Lightbox>,
    );
    fireEvent.doubleClick(screen.getByTestId('out'));
    expect(expanded()).toBe(true);
    expect(root().getAttribute('role')).toBe('dialog');
    fireEvent.doubleClick(screen.getByTestId('out'));
    expect(expanded()).toBe(false);
  });

  it('ignores a double-click on a control, on an opted-out region, or one already handled', () => {
    render(
      <Lightbox expandOnDoubleClick>
        <button type="button">Run</button>
        <input aria-label="n" />
        <div data-lk-lightbox-ignore="">
          <span data-testid="ignored">x</span>
        </div>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: the subject is a handler that claims the gesture */}
        <div data-testid="claimed" onDoubleClick={(e) => e.preventDefault()} />
      </Lightbox>,
    );
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Run' }));
    fireEvent.doubleClick(screen.getByLabelText('n'));
    fireEvent.doubleClick(screen.getByTestId('ignored'));
    fireEvent.doubleClick(screen.getByTestId('claimed'));
    expect(expanded()).toBe(false);
  });

  it('opens from the expand button and moves focus to the close button, then back', () => {
    render(
      <Lightbox>
        <div>output</div>
      </Lightbox>,
    );
    const open = screen.getByRole('button', { name: 'Expand' });
    open.focus();
    fireEvent.click(open);
    const close = screen.getByRole('button', { name: 'Close expanded view' });
    expect(document.activeElement).toBe(close);
    fireEvent.click(close);
    expect(expanded()).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Expand' }));
  });

  it('closes on Escape unless something inside handled it', () => {
    render(
      <Lightbox>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: stands in for an overlay that consumes its own Escape */}
        <div data-testid="menu" onKeyDown={(e) => e.preventDefault()} />
      </Lightbox>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
    fireEvent.keyDown(screen.getByTestId('menu'), { key: 'Escape' });
    expect(expanded()).toBe(true);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(expanded()).toBe(false);
  });

  it('closes on a click in the margin, not on one in the content', () => {
    render(
      <Lightbox>
        <div data-testid="out">output</div>
      </Lightbox>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
    fireEvent.click(screen.getByTestId('out'));
    expect(expanded()).toBe(true);
    fireEvent.click(root());
    expect(expanded()).toBe(false);
  });

  it('makes everything outside it inert while open, and only what it marked', () => {
    render(
      <div>
        <aside data-testid="already" inert />
        <nav data-testid="sibling" />
        <Lightbox>
          <div>output</div>
        </Lightbox>
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
    expect(screen.getByTestId('sibling').hasAttribute('inert')).toBe(true);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.getByTestId('sibling').hasAttribute('inert')).toBe(false);
    expect(screen.getByTestId('already').hasAttribute('inert')).toBe(true);
  });

  it('marks itself a portal host only while open, so overlays stack inside it', () => {
    render(
      <Lightbox>
        <div>output</div>
      </Lightbox>,
    );
    expect(root().hasAttribute('data-wzl-portal-host')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
    expect(root().hasAttribute('data-wzl-portal-host')).toBe(true);
  });

  it('drops its corner button while a descendant draws the control', () => {
    function OwnControl() {
      const lb = useLightboxControl();
      return (
        <button type="button" onClick={lb?.toggle}>
          Mine
        </button>
      );
    }
    render(
      <Lightbox>
        <OwnControl />
      </Lightbox>,
    );
    expect(screen.queryByRole('button', { name: 'Expand' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mine' }));
    expect(expanded()).toBe(true);
  });

  it('can be controlled', () => {
    const onChange = vi.fn();
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <Lightbox
          expanded={open}
          onExpandedChange={(next) => {
            onChange(next);
            setOpen(next);
          }}
        >
          <div>output</div>
        </Lightbox>
      );
    }
    render(<Host />);
    expect(expanded()).toBe(true);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onChange).toHaveBeenCalledWith(false);
    expect(expanded()).toBe(false);
  });

  it('keeps its content mounted when it is turned off', () => {
    let mounts = 0;
    function Content() {
      useState(() => {
        mounts += 1;
      });
      return <div data-testid="out" />;
    }
    const { rerender } = render(
      <Lightbox expandOnDoubleClick>
        <Content />
      </Lightbox>,
    );
    act(() => {
      rerender(
        <Lightbox disabled expandOnDoubleClick>
          <Content />
        </Lightbox>,
      );
    });
    fireEvent.doubleClick(screen.getByTestId('out'));
    expect(expanded()).toBe(false);
    expect(screen.queryByRole('button', { name: 'Expand' })).toBeNull();
    expect(mounts).toBe(1);
  });
});
