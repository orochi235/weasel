import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { renderWithIcons } from '../../testing/withIcons';
import { Bar } from './Bar';

afterEach(cleanup);

const schema: PrefGroup = pref.group('Text', {
  size: pref.number('Size', 12),
  bold: { ...pref.boolean('Bold', true), control: 'toggle' },
  kern: { ...pref.number('Kern', 0), enableIf: { path: 'bold' } },
}, { as: 'bar' });

const spin = (name: string) => screen.getByRole('spinbutton', { name }) as HTMLInputElement;
const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

describe('Bar defaults', () => {
  it('shows a leaf its values lack at its default, as a params surface does', () => {
    renderWithIcons(<Bar schema={schema} values={{}} />);
    expect(spin('Size').value).toBe('12');
    expect(pressed('Bold')).toBe('true');
  });

  it('reads an unset path at its default for a condition', () => {
    renderWithIcons(<Bar schema={schema} values={{}} />);
    expect(spin('Kern').disabled).toBe(false);
  });

  it('shows a held value over the default', () => {
    renderWithIcons(<Bar schema={schema} values={{ size: 20, bold: false }} />);
    expect(spin('Size').value).toBe('20');
    expect(pressed('Bold')).toBe('false');
    expect(spin('Kern').disabled).toBe(true);
  });
});
