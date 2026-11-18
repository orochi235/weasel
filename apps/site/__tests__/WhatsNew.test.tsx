import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WhatsNew } from '../WhatsNew';
import { DEMOS } from '../registry';

afterEach(cleanup);

const titles = () => within(screen.getByRole('table')).getAllByRole('link').map((a) => a.textContent);
const header = (name: string) => screen.getByRole('columnheader', { name: new RegExp(name) });

describe('the demo updates page', () => {
  it('lists every demo, newest change first, and says how it is sorted', () => {
    render(<WhatsNew onSelect={() => {}} />);
    const newest = Math.max(...DEMOS.map((d) => (d.lastModified ? Date.parse(d.lastModified) : 0)));
    expect(titles()).toHaveLength(DEMOS.length);
    expect(Date.parse(DEMOS.find((d) => d.title === titles()[0])!.lastModified!)).toBe(newest);
    expect(header('Last modified')).toHaveAttribute('aria-sort', 'descending');
  });

  it('sorts by a column its header names', () => {
    render(<WhatsNew onSelect={() => {}} />);
    fireEvent.click(within(header('Demo')).getByRole('button'));
    expect(header('Demo')).toHaveAttribute('aria-sort', 'ascending');
    expect(titles()[0]).toBe([...DEMOS].map((d) => d.title).sort()[0]);
  });

  it('opens a demo picked from it', () => {
    const onSelect = vi.fn();
    render(<WhatsNew onSelect={onSelect} />);
    fireEvent.click(within(screen.getByRole('table')).getAllByRole('link')[0]!);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
