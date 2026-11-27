import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatRow, type Stat } from './StatRow';

const css = readFileSync(resolve(__dirname, 'StatRow.module.css'), 'utf8');

const STATS: Stat[] = [
  { label: 'found', value: '42' },
  { label: 'left', value: '7', tone: 'estimate', tip: 'from the depletion fit' },
  { label: 'fixed', value: '30', accent: 'rgb(0, 128, 0)' },
  { label: 'elapsed', value: '9:41', tone: 'clock' },
];

const draw = (stats = STATS, props: { justify?: 'start' | 'between' } = {}) => render(<StatRow aria-label="Glance" stats={stats} {...props} />);

describe('StatRow', () => {
  it('lists each figure as a term and its value, the word first for a screen reader', () => {
    draw();
    const list = screen.getByLabelText('Glance');
    expect(list.tagName).toBe('DL');
    const first = list.children[0]!;
    expect([...first.children].map((c) => [c.tagName, c.textContent])).toEqual([['DT', 'found'], ['DD', '42']]);
    expect(within(list).getAllByRole('term')).toHaveLength(4);
  });

  it('marks each toned figure, and titles an estimate as one', () => {
    const { container } = draw();
    const items = [...container.querySelectorAll('dl > div')];
    expect(items.map((i) => i.getAttribute('data-tone'))).toEqual([null, 'estimate', null, 'clock']);
    expect(screen.getByText('7').getAttribute('title')).toBe('an estimate');
    expect(screen.getByText('42').hasAttribute('title')).toBe(false);
  });

  it('makes a word with a tip focusable and shows the tip in a tooltip on focus', () => {
    draw();
    const word = screen.getByText('left');
    expect(word.tabIndex).toBe(0);
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => word.focus());
    expect(screen.getByText('from the depletion fit')).toBeInTheDocument();
    expect(screen.getByText('found').tabIndex).toBe(-1);
  });

  it('carries an accent as --stat-accent on its figure, and reserves the bar only where a figure has one', () => {
    const { container } = draw();
    const items = [...container.querySelectorAll<HTMLElement>('dl > div')];
    expect(items[2]!.style.getPropertyValue('--stat-accent')).toBe('rgb(0, 128, 0)');
    expect(items[0]!.style.getPropertyValue('--stat-accent')).toBe('');
    expect(container.querySelector('dl')!.hasAttribute('data-accented')).toBe(true);
    expect(draw([{ label: 'a', value: '1' }]).container.querySelector('dl')!.hasAttribute('data-accented')).toBe(false);
  });

  it('packs from the start by default, or spreads end to end', () => {
    expect(draw().container.querySelector('dl')!.dataset.justify).toBe('start');
    expect(draw(STATS, { justify: 'between' }).container.querySelector('dl')!.dataset.justify).toBe('between');
  });

  it('sets values in the numeric face, a clock held to a fixed width', () => {
    expect(css).toMatch(/\.value \{\s*composes: numeric from '@weasel-js\/theme\/numeric\.module\.css';/);
    expect(css).toMatch(/\.clock \.value \{\s*min-width: 5ch;\s*text-align: end;/);
  });
});
