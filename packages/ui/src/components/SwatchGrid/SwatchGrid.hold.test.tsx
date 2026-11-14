import { expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { arcShape } from '@weasel-js/geom';
import { describeHold, type HoldSubject } from '../Disabled/testing/holdCases';
import { Along } from '../Along';
import { ReadOnly } from '../Disabled';
import { SwatchGrid, type SwatchGridOption } from './SwatchGrid';

const OPTIONS: SwatchGridOption[] = [
  { value: '#ff0000ff', label: 'Red' },
  { value: '#00ff00ff', label: 'Green' },
];

function palette(wrapRun: (node: ReactElement) => ReactElement): HoldSubject {
  return (mount, own) => {
    const onChange = vi.fn();
    const onAltChange = vi.fn();
    mount(wrapRun(<SwatchGrid aria-label="Colors" options={OPTIONS} value="#ff0000ff" onChange={onChange} onAltChange={onAltChange} {...own} />));
    const swatches = () => screen.getAllByRole('button');
    return {
      targets: swatches,
      // A held palette refuses only applies: the arrows still rove, which the reason cases' reachability shows.
      tryAll: () => {
        const green = screen.getByRole('button', { name: 'Green' });
        fireEvent.click(green);
        fireEvent.click(green, { shiftKey: true });
        fireEvent.contextMenu(green);
        fireEvent.keyDown(green, { key: 'Enter', shiftKey: true });
      },
      changed: () => onChange.mock.calls.length + onAltChange.mock.calls.length > 0,
    };
  };
}

describeHold('SwatchGrid', palette((n) => n));
const ARC = arcShape({ center: { x: 200, y: 200 }, radius: 100, start: 270, end: 90 });
describeHold('SwatchGrid on rings', palette((n) => <Along shape={ARC}>{n}</Along>));

it('read-only, the arrows still move among the swatches', () => {
  render(<ReadOnly><SwatchGrid aria-label="Colors" options={OPTIONS} onChange={() => {}} /></ReadOnly>);
  const [red, green] = screen.getAllByRole('button');
  red!.focus();
  fireEvent.keyDown(red!, { key: 'ArrowRight' });
  expect(green).toHaveFocus();
});
