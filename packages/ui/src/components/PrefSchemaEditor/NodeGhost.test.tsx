import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { NodeGhost } from './NodeGhost';

afterEach(cleanup);

const group = (as: PrefGroup['as']): PrefGroup => ({
  name: 'Sound',
  description: '',
  as,
  children: { loud: { kind: 'boolean', name: 'Loud', description: '', default: false } },
});

describe('NodeGhost', () => {
  it('draws a leaf as its row: its name beside its control', () => {
    const leaf: PrefLeaf = { kind: 'boolean', name: 'Snap', description: '', default: true };
    render(<NodeGhost node={leaf} />);
    expect(screen.getByRole('checkbox', { name: 'Snap' })).toBeChecked();
  });

  it('draws a tab as a tab and a section as a heading, without what they hold', () => {
    const { unmount } = render(<NodeGhost node={group('tab')} />);
    expect(screen.getByRole('tab', { name: 'Sound' })).toBeInTheDocument();
    expect(screen.queryByText('Loud')).toBeNull();
    unmount();
    render(<NodeGhost node={group('section')} />);
    expect(screen.getByRole('heading', { name: 'Sound' })).toBeInTheDocument();
    expect(screen.queryByText('Loud')).toBeNull();
  });

  it('draws a page, or a top-level group that names no drawing, as its name alone', () => {
    const { container, unmount } = render(<NodeGhost node={group('page')} />);
    expect(container).toHaveTextContent(/^Sound$/);
    expect(screen.queryByRole('heading')).toBeNull();
    unmount();
    render(<NodeGhost node={group(undefined)} topLevel />);
    expect(screen.queryByRole('heading')).toBeNull();
  });
});
