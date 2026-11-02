import { cleanup, screen } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { afterEach, describe, expect, it } from 'vitest';
import { PrefsForm } from './PrefsForm';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

const num = (name: string, extra: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, ...extra }) as PrefLeaf;
const noop = (): void => {};
const disabledRow = (el: HTMLElement): Element | null => el.closest('[data-property-row][data-disabled]');

const schema: PrefGroup = {
  name: '',
  children: {
    view: {
      name: 'View',
      children: {
        lift: num('Lift'),
        spread: num('Spread', { enableIf: { path: 'view.lift', above: 1 } }),
        stroke: { kind: 'object', name: 'Stroke', description: '', default: {}, children: { width: num('Width'), gap: num('Gap') } } as PrefLeaf,
      },
    },
  },
};

describe('PrefsForm disabled', () => {
  it('draws the rows it names disabled, and leaves the rest live', () => {
    renderWithIcons(<PrefsForm schema={schema} values={{ view: { lift: 5 } }} disabled={new Set(['view.lift'])} onChange={noop} />);
    const lift = screen.getByRole('spinbutton', { name: 'Lift' });
    expect(lift).toBeDisabled();
    expect(disabledRow(lift)).not.toBeNull();
    expect(screen.getByRole('spinbutton', { name: 'Spread' })).toBeEnabled();
  });

  it("adds to what the schema's own conditions disable", () => {
    renderWithIcons(<PrefsForm schema={schema} values={{ view: { lift: 0 } }} disabled={new Set(['view.lift'])} onChange={noop} />);
    expect(screen.getByRole('spinbutton', { name: 'Lift' })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: 'Spread' })).toBeDisabled();
  });

  it("disables one field of an object leaf by the field's path", () => {
    renderWithIcons(<PrefsForm schema={schema} values={{ view: { lift: 5 } }} disabled={new Set(['view.stroke.gap'])} onChange={noop} />);
    expect(screen.getByRole('spinbutton', { name: 'Gap' })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: 'Width' })).toBeEnabled();
  });
});
