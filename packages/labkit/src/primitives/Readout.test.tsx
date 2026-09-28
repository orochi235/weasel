import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as labkit from '../index';
import { Readout } from './Readout';

function must<T>(el: T | null): T {
  if (el == null) throw new Error('expected an element');
  return el;
}

describe('Readout', () => {
  it('renders its rows as one <dl>, in order, each a label and a value', () => {
    const { container } = render(
      <Readout
        rows={[
          { label: 'Lock margin', value: '+47.9°' },
          { label: 'Score', value: '0.145' },
        ]}
      />,
    );
    const dl = must(container.querySelector('dl'));
    expect([...dl.querySelectorAll('dt')].map((d) => d.textContent)).toEqual([
      'Lock margin',
      'Score',
    ]);
    expect([...dl.querySelectorAll('dd')].map((d) => d.textContent)).toEqual(['+47.9°', '0.145']);
  });

  it('sets its values as figures', () => {
    const { container } = render(<Readout rows={[{ label: 'a', value: '1' }]} />);
    expect(must(container.querySelector('dl')).getAttribute('data-values')).toBe('figures');
  });

  it('keeps a row whose value is absent, showing a dash', () => {
    const { container } = render(
      <Readout
        rows={[
          { label: 'Lock margin', value: undefined },
          { label: 'Score', value: '0.145' },
        ]}
      />,
    );
    expect(container.querySelectorAll('dl > div')).toHaveLength(2);
    expect(must(container.querySelector('dd')).textContent).toBe('–');
  });

  it('marks a row with its status', () => {
    const { container } = render(
      <Readout rows={[{ label: 'Lock', value: 'locked', status: 'success' }]} />,
    );
    expect(must(container.querySelector('dl > div')).getAttribute('data-status')).toBe('success');
  });

  it('puts its children below the rows', () => {
    const { container } = render(
      <Readout rows={[{ label: 'a', value: '1' }]}>
        <p>note</p>
      </Readout>,
    );
    const root = must(container.firstElementChild);
    expect(root.className).toContain('lk-readout');
    const note = screen.getByText('note');
    expect(
      must(root.querySelector('dl')).compareDocumentPosition(note) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(note.closest('dl')).toBeNull();
  });

  it('draws no footer without children', () => {
    const { container } = render(<Readout rows={[{ label: 'a', value: '1' }]} />);
    expect(container.querySelector('.lk-readout__footer')).toBeNull();
  });

  it('names the list by its title', () => {
    render(<Readout title="Measure" rows={[{ label: 'a', value: '1' }]} />);
    const heading = screen.getByRole('heading', { name: 'Measure' });
    expect(
      must(must(heading.parentElement).querySelector('dl')).getAttribute('aria-labelledby'),
    ).toBe(heading.id);
  });

  it('merges a consumer className on its root', () => {
    const { container } = render(<Readout className="mine" rows={[]} />);
    expect(must(container.firstElementChild).className).toMatch(/\blk-readout\b.*\bmine\b/);
  });

  it('is exported from the labkit barrel, with the list it is built on', () => {
    expect(labkit.Readout).toBe(Readout);
    expect(typeof labkit.DetailList).toBe('function');
    expect(typeof labkit.DetailRow).toBe('function');
  });
});
