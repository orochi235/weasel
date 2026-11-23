import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SurfaceContext } from '../surface/SurfaceContext';
import type { SurfaceHandle } from '../surface/useTiledSurface';
import { Lightbox } from './Lightbox';
import { useLightboxControl } from './LightboxContext';
import { LightboxLayers } from './LightboxLayers';

function root(): HTMLElement {
  return document.querySelector('.lk-lightbox') as HTMLElement;
}

const expanded = (): boolean => root().classList.contains('lk-lightbox--expanded');

describe('Lightbox', () => {
  it('does not open on a double-click unless asked to', () => {
    renderWithIcons(
      <Lightbox>
        <div data-testid="out">output</div>
      </Lightbox>,
    );
    fireEvent.doubleClick(screen.getByTestId('out'));
    expect(expanded()).toBe(false);
    expect(screen.getByRole('button', { name: 'Expand' })).toBeInTheDocument();
  });

  it('opens on a double-click on its content when asked to, and closes on another', () => {
    renderWithIcons(
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
    renderWithIcons(
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
    renderWithIcons(
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

  it('keeps focus where it is inside when its layers change while open, and still returns it on close', () => {
    const view = (n: number) => (
      <LightboxLayers below={[]} above={Array.from({ length: n }, () => null)}>
        <Lightbox>
          <input aria-label="inside" />
        </Lightbox>
      </LightboxLayers>
    );
    const { rerender } = renderWithIcons(view(0));
    const open = screen.getByRole('button', { name: 'Expand' });
    open.focus();
    fireEvent.click(open);
    const inside = screen.getByLabelText('inside');
    inside.focus();
    rerender(view(1));
    expect(expanded()).toBe(true);
    expect(document.activeElement).toBe(inside);
    fireEvent.click(screen.getByRole('button', { name: 'Close expanded view' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Expand' }));
  });

  it('returns focus on close when something inside had it', () => {
    renderWithIcons(
      <Lightbox>
        <input aria-label="inside" />
      </Lightbox>,
    );
    const open = screen.getByRole('button', { name: 'Expand' });
    open.focus();
    fireEvent.click(open);
    screen.getByLabelText('inside').focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(expanded()).toBe(false);
    expect(document.activeElement).toBe(open);
  });

  it('returns focus when it unmounts while open', () => {
    const view = (shown: boolean) => (
      <>
        <button type="button">outside</button>
        {shown ? (
          <Lightbox expanded>
            <div>output</div>
          </Lightbox>
        ) : null}
      </>
    );
    const { rerender } = renderWithIcons(view(false));
    const outside = screen.getByRole('button', { name: 'outside' });
    outside.focus();
    rerender(view(true));
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Close expanded view' }),
    );
    rerender(view(false));
    expect(document.activeElement).toBe(outside);
  });

  it('closes on Escape unless something inside handled it', () => {
    renderWithIcons(
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
    renderWithIcons(
      <Lightbox>
        <div data-testid="out">output</div>
      </Lightbox>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
    fireEvent.pointerDown(screen.getByTestId('out'));
    fireEvent.click(screen.getByTestId('out'));
    expect(expanded()).toBe(true);
    fireEvent.pointerDown(root());
    fireEvent.click(root());
    expect(expanded()).toBe(false);
  });

  it('stays open after a drag that starts in the content and is released in the margin', () => {
    renderWithIcons(
      <Lightbox>
        <div data-testid="out">output</div>
      </Lightbox>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
    fireEvent.pointerDown(screen.getByTestId('out'));
    // The browser sends the click to the press and release targets' common ancestor: the root.
    fireEvent.click(root());
    expect(expanded()).toBe(true);
  });

  it('makes everything outside it inert while open, and only what it marked', () => {
    renderWithIcons(
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
    renderWithIcons(
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
    renderWithIcons(
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
    renderWithIcons(<Host />);
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
    const { rerender } = renderWithIcons(
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

  it('closes an open one when disabled, says so, and stays closed when enabled again', () => {
    const heard: boolean[] = [];
    const view = (disabled: boolean) => (
      <Lightbox expandOnDoubleClick disabled={disabled} onExpandedChange={(e) => heard.push(e)}>
        <div data-testid="out" />
      </Lightbox>
    );
    const { rerender } = renderWithIcons(view(false));
    fireEvent.doubleClick(screen.getByTestId('out'));
    expect(expanded()).toBe(true);
    act(() => rerender(view(true)));
    expect(expanded()).toBe(false);
    expect(heard).toEqual([true, false]);
    act(() => rerender(view(false)));
    expect(expanded()).toBe(false);
  });

  it('tells a controlled parent an open one closed when disabled', () => {
    const onExpandedChange = vi.fn();
    const { rerender } = renderWithIcons(
      <Lightbox expanded onExpandedChange={onExpandedChange}>
        <div />
      </Lightbox>,
    );
    act(() =>
      rerender(
        <Lightbox expanded disabled onExpandedChange={onExpandedChange}>
          <div />
        </Lightbox>,
      ),
    );
    expect(onExpandedChange).toHaveBeenCalledWith(false);
  });

  it('tells a controlled parent that mounts it disabled and open that it is closed, so enabling it opens nothing', () => {
    const heard: boolean[] = [];
    let enable = (): void => undefined;
    function Parent() {
      const [open, setOpen] = useState(true);
      const [disabled, setDisabled] = useState(true);
      enable = () => setDisabled(false);
      return (
        <Lightbox
          expanded={open}
          disabled={disabled}
          onExpandedChange={(e) => {
            heard.push(e);
            setOpen(e);
          }}
        >
          <div />
        </Lightbox>
      );
    }
    renderWithIcons(<Parent />);
    expect(heard).toEqual([false]);
    act(() => enable());
    expect(expanded()).toBe(false);
  });

  it('closes the innermost of two open lightboxes on Escape, then the outer one', () => {
    renderWithIcons(
      <Lightbox label="outer">
        <Lightbox label="inner">
          <div />
        </Lightbox>
      </Lightbox>,
    );
    const [outer, inner] = [...document.querySelectorAll('.lk-lightbox')] as [
      HTMLElement,
      HTMLElement,
    ];
    const open = (el: HTMLElement): boolean => el.classList.contains('lk-lightbox--expanded');
    const expandOf = (el: HTMLElement) =>
      el.querySelector(':scope > .lk-lightbox__open') as HTMLElement;
    fireEvent.click(expandOf(outer));
    expect(open(outer)).toBe(true);
    fireEvent.click(expandOf(inner));
    expect(open(inner)).toBe(true);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect([open(outer), open(inner)]).toEqual([true, false]);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect([open(outer), open(inner)]).toEqual([false, false]);
  });

  it("gives a surface back the outer lightbox's scope when the inner one closes", () => {
    const scope = vi.fn();
    const surface = { scope } as unknown as SurfaceHandle;
    renderWithIcons(
      <SurfaceContext.Provider value={surface}>
        <Lightbox label="outer">
          <Lightbox label="inner">
            <div />
          </Lightbox>
        </Lightbox>
      </SurfaceContext.Provider>,
    );
    const [outer, inner] = [...document.querySelectorAll('.lk-lightbox')] as [
      HTMLElement,
      HTMLElement,
    ];
    const expandOf = (el: HTMLElement) =>
      el.querySelector(':scope > .lk-lightbox__open') as HTMLElement;
    fireEvent.click(expandOf(outer));
    const outerScope = scope.mock.lastCall?.[0];
    expect(outerScope).toContain(outer);
    fireEvent.click(expandOf(inner));
    expect(scope.mock.lastCall?.[0]).toContain(inner);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(scope.mock.lastCall?.[0]).toBe(outerScope);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(scope.mock.lastCall?.[0]).toBe(null);
  });
});
