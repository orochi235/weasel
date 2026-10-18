import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { Bar } from './Bar';
import { renderWithIcons } from '../../testing/withIcons';

const num = (name: string): PrefLeaf => ({ kind: 'number', name, description: '', default: 1 }) as PrefLeaf;

const schema: PrefGroup = {
  name: 'Tools',
  as: 'bar',
  children: {
    more: {
      name: 'More',
      as: 'page',
      children: {
        gap: num('Gap'),
        fill: { name: 'Fill', as: 'tab', children: { opacity: num('Opacity') } },
        edge: { name: 'Edge', as: 'tab', children: { width: num('Width') } },
        box: { name: 'Box', as: 'panel', children: { inset: num('Inset') } },
      },
    },
  },
};

describe('a group a standalone Bar opens', () => {
  it('draws its nested groups as a form draws them: neighboring tabs as one strip, a panel in a box of its own', () => {
    renderWithIcons(<Bar schema={schema} values={{}} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('tab', { name: 'Fill' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Edge' })).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Box' })).getByLabelText('Inset')).toBeTruthy();
  });

  it('draws its leaves as the bar draws a row: unset where the values hold nothing, written at the dotted path', () => {
    const onChange = vi.fn();
    renderWithIcons(<Bar schema={schema} values={{ 'more.fill.opacity': 0.5 }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByLabelText('Gap')).toHaveValue('');
    const opacity = screen.getByLabelText('Opacity');
    expect(opacity).toHaveValue('0.5');
    fireEvent.change(opacity, { target: { value: '0.25' } });
    fireEvent.blur(opacity);
    expect(onChange).toHaveBeenCalledWith('more.fill.opacity', 0.25);
  });
});
