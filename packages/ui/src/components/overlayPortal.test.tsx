import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { Callout } from './Callout';
import { ComboBox } from './ComboBox';
import { Dialog } from './Dialog';
import { Select } from './Select';
import { Tooltip, TooltipTrigger } from './Tooltip';
import { OverlayPortalProvider } from '../overlays/portalHost';
import { renderWithIcons } from '../testing/withIcons';

/**
 * A portalled overlay has to land inside the element the theme was applied
 * to, or every `--wzl-*` it reads resolves to nothing. jsdom resolves
 * neither `var()` nor `color-mix()`, so these assert the DOM relationship —
 * which element the overlay actually mounted into — as the proxy for the
 * visual result.
 */
const OPTIONS = [
  { value: 'r', label: 'Red' },
  { value: 'g', label: 'Green' },
];

function Themed({ children }: { children: React.ReactNode }) {
  return (
    <div data-wzl-theme="interstellar" data-wzl-mode="dark" data-testid="themed">
      {children}
    </div>
  );
}

/** The themed element the overlay ended up inside, or null for the body. */
function host(): Element | null {
  const overlay = document.querySelector('[data-weasel-overlay]');
  if (!overlay) throw new Error('no overlay rendered');
  return overlay.closest('[data-wzl-theme]');
}

describe('overlays portal into the nearest themed ancestor', () => {
  it('Select popover', () => {
    renderWithIcons(<Themed><Select label="Color" options={OPTIONS} /></Themed>);
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Color/ })); });
    expect(host()).toBe(screen.getByTestId('themed'));
  });

  it('ComboBox popover', () => {
    renderWithIcons(<Themed><ComboBox label="Color" options={OPTIONS} /></Themed>);
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Show options/ })); });
    expect(host()).toBe(screen.getByTestId('themed'));
  });

  it('Dialog overlay', () => {
    renderWithIcons(<Themed><Dialog isOpen title="Hi" onOpenChange={() => {}}>body</Dialog></Themed>);
    expect(host()).toBe(screen.getByTestId('themed'));
  });

  it('Callout popover', () => {
    renderWithIcons(
      <Themed>
        <Callout isOpen anchorRect={{ x: 0, y: 0, width: 10, height: 10 }} aria-label="c">
          body
        </Callout>
      </Themed>,
    );
    expect(host()).toBe(screen.getByTestId('themed'));
  });

  it('Tooltip bubble', () => {
    renderWithIcons(
      <Themed>
        <TooltipTrigger isOpen delay={0}>
          <button type="button">trigger</button>
          <Tooltip>hint</Tooltip>
        </TooltipTrigger>
      </Themed>,
    );
    expect(host()).toBe(screen.getByTestId('themed'));
  });

  it('finds the innermost themed ancestor, not the outermost', () => {
    renderWithIcons(
      <div data-wzl-theme="outer" data-wzl-mode="light">
        <div data-wzl-theme="inner" data-wzl-mode="dark" data-testid="inner">
          <Dialog isOpen title="Hi">body</Dialog>
        </div>
      </div>,
    );
    expect(host()).toBe(screen.getByTestId('inner'));
  });

  it('honors an explicit host element opted in with data-wzl-portal-host', () => {
    renderWithIcons(
      <div data-wzl-theme="outer" data-wzl-mode="light">
        <div data-wzl-portal-host="" data-testid="opted">
          <Dialog isOpen title="Hi">body</Dialog>
        </div>
      </div>,
    );
    const overlay = document.querySelector('[data-weasel-overlay]')!;
    expect(overlay.closest('[data-testid="opted"]')).toBe(screen.getByTestId('opted'));
  });
});

describe('consumers can override where an overlay portals', () => {
  it('a portalContainer prop wins over the themed ancestor', () => {
    const elsewhere = document.createElement('div');
    elsewhere.setAttribute('data-testid', 'elsewhere');
    document.body.appendChild(elsewhere);
    renderWithIcons(
      <Themed>
        <Dialog isOpen title="Hi" portalContainer={elsewhere}>body</Dialog>
      </Themed>,
    );
    expect(document.querySelector('[data-weasel-overlay]')?.closest('[data-testid="elsewhere"]')).toBe(
      elsewhere,
    );
    elsewhere.remove();
  });

  it('portalContainer={null} sends it to the body', () => {
    renderWithIcons(
      <Themed>
        <Dialog isOpen title="Hi" portalContainer={null}>body</Dialog>
      </Themed>,
    );
    expect(host()).toBeNull();
  });

  it('portalContainer={null} sends it to the body from inside another overlay', () => {
    renderWithIcons(
      <Themed>
        <Dialog isOpen title="Hi">
          <Select label="Color" options={OPTIONS} portalContainer={null} />
        </Dialog>
      </Themed>,
    );
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Color/ })); });
    expect(screen.getByRole('listbox').closest('[data-wzl-theme]')).toBeNull();
  });

  it('a nested overlay portals into the themed ancestor too', () => {
    renderWithIcons(
      <Themed>
        <Dialog isOpen title="Hi">
          <Select label="Color" options={OPTIONS} />
        </Dialog>
      </Themed>,
    );
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Color/ })); });
    expect(screen.getByRole('listbox').closest('[data-wzl-theme]')).toBe(screen.getByTestId('themed'));
  });

  it('OverlayPortalProvider sets the container for a whole subtree', () => {
    const elsewhere = document.createElement('div');
    document.body.appendChild(elsewhere);
    renderWithIcons(
      <Themed>
        <OverlayPortalProvider container={elsewhere}>
          <Dialog isOpen title="Hi">body</Dialog>
        </OverlayPortalProvider>
      </Themed>,
    );
    expect(elsewhere.querySelector('[data-weasel-overlay]')).not.toBeNull();
    elsewhere.remove();
  });
});

describe('the portal host lookup', () => {
  it('walks the ancestors once per mount, not once per render', () => {
    const closest = vi.spyOn(Element.prototype, 'closest');
    const lookups = () => closest.mock.calls.filter(([selector]) => selector.includes('data-wzl-portal-host')).length;
    const tree = (n: number) => (
      <Themed>
        <TooltipTrigger delay={0}>
          <button type="button">{`trigger ${n}`}</button>
          <Tooltip>hint</Tooltip>
        </TooltipTrigger>
      </Themed>
    );
    const { rerender } = renderWithIcons(tree(0));
    const atMount = lookups();
    for (let n = 1; n <= 5; n++) rerender(tree(n));
    expect(lookups()).toBe(atMount);
    closest.mockRestore();
  });
});
