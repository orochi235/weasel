import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it } from 'vitest';
import { SectionJump } from './SectionJump';

/** A bar and a panel of colors then motion, with the list scrolled as `scrollTop` says. jsdom lays nothing out. */
function mount(hostClass?: string) {
  renderWithIcons(
    <div className={hostClass}>
      <SectionJump />
      <div className="fg-css-vars">
        <div className="fg-css-vars__list">
          <section data-token-category="color" />
          <section data-token-category="motion" />
        </div>
      </div>
    </div>,
  );
  const list = document.querySelector<HTMLElement>('.fg-css-vars__list')!;
  let top = 0;
  Object.defineProperty(list, 'scrollTop', { get: () => top, set: (v: number) => (top = v), configurable: true });
  return { list, scrollBy: (dy: number) => act(() => { top += dy; fireEvent.scroll(list); }) };
}

const lit = () => screen.getByRole('radiogroup', { name: 'Jump to section' }).querySelector('[aria-checked="true"]')?.getAttribute('aria-label');

describe('SectionJump', () => {
  it('jumps to a section in a host that is not a sidebar section or a tile, where it reads the panel too', () => {
    mount();
    expect(lit()).toBe('Motion');
    fireEvent.click(screen.getByRole('radio', { name: 'Color' }));
    expect(lit()).toBe('Color');
  });

  it('lets go of a picked section once the list moves other than by wheel, touch or key', () => {
    const { scrollBy } = mount('lk-sidebar-section');
    fireEvent.click(screen.getByRole('radio', { name: 'Color' }));
    scrollBy(0);
    expect(lit()).toBe('Color');
    scrollBy(40);
    expect(lit()).toBe('Motion');
  });
});
