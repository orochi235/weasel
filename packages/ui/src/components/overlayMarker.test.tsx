import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Callout } from './Callout';
import { ComboBox } from './ComboBox';
import { Dialog } from './Dialog';
import { Select } from './Select';
import { Tooltip, TooltipTrigger } from './Tooltip';

/**
 * Every overlay this package renders into a portal carries
 * `data-weasel-overlay`. Consumers answer "did focus leave my component?"
 * with `closest('[data-weasel-overlay]')`; an unmarked overlay reads as
 * outside the control it belongs to.
 */
const OPTIONS = [
  { value: 'r', label: 'Red' },
  { value: 'g', label: 'Green' },
];

function marked(): boolean {
  return document.querySelector('[data-weasel-overlay]') !== null;
}

describe('portal overlays carry data-weasel-overlay', () => {
  it('Select popover', () => {
    render(<Select label="Color" options={OPTIONS} />);
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Color/ })); });
    expect(marked()).toBe(true);
  });

  it('ComboBox popover', () => {
    render(<ComboBox label="Color" options={OPTIONS} />);
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Show options/ })); });
    expect(marked()).toBe(true);
  });

  it('Dialog overlay', () => {
    render(<Dialog isOpen title="Hi" onOpenChange={() => {}}>body</Dialog>);
    expect(marked()).toBe(true);
  });

  it('Callout popover', () => {
    render(<Callout isOpen anchorRect={{ x: 0, y: 0, width: 10, height: 10 }} aria-label="c">body</Callout>);
    expect(marked()).toBe(true);
  });

  it('Tooltip bubble', () => {
    render(
      <TooltipTrigger isOpen delay={0}>
        <button type="button">trigger</button>
        <Tooltip>hint</Tooltip>
      </TooltipTrigger>,
    );
    expect(marked()).toBe(true);
  });
});
