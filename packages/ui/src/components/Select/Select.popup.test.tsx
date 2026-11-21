import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import type { PopoverProps } from '../Popover';
import { Select } from './Select';

const flips = vi.hoisted(() => [] as Array<boolean | undefined>);

vi.mock('../Popover', async (load) => {
  const real = await load<typeof import('../Popover')>();
  return {
    ...real,
    Popover: (props: PopoverProps) => {
      flips.push(props.shouldFlip);
      return <real.Popover {...props} />;
    },
  };
});

const OPTIONS = [
  { value: 'r', label: 'Red' },
  { value: 'g', label: 'Green' },
];

describe("Select popup='over'", () => {
  it('flips a list with no selected row, which hangs below its trigger', () => {
    render(<Select aria-label="Color" options={OPTIONS} placeholder="Pick" />);
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Color/ })); });
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(flips.at(-1)).toBe(true);
  });

  it('keeps a list over its selected row from flipping', () => {
    render(<Select aria-label="Color" options={OPTIONS} defaultSelectedKey="g" />);
    act(() => { fireEvent.click(screen.getByRole('button', { name: /Color/ })); });
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(flips.at(-1)).toBe(false);
  });
});
