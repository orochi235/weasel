import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { BAR_ITEM, useBarOverflow } from './useBarOverflow';

afterEach(cleanup);

/** A bar holding `keys`, of which only `drawn` are on its line to be measured. */
function Line({ keys, drawn }: { keys: string[]; drawn: string[] }) {
  const { bar, natural } = useBarOverflow(true, keys, false);
  return (
    <div ref={bar} data-testid="bar" data-natural={natural ?? 'unknown'}>
      {drawn.map((key) => <span key={key} {...{ [BAR_ITEM]: key }}>{key}</span>)}
    </div>
  );
}

it('forgets the size of an item that leaves, so one coming back off the line is measured afresh', () => {
  const { rerender } = render(<Line keys={['a', 'b']} drawn={['a', 'b']} />);
  expect(screen.getByTestId('bar').dataset.natural).not.toBe('unknown');
  rerender(<Line keys={['a']} drawn={['a']} />);
  rerender(<Line keys={['a', 'b']} drawn={['a']} />);
  expect(screen.getByTestId('bar').dataset.natural).toBe('unknown');
});
