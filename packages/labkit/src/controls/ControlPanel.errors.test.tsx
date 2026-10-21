import { screen } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

const schema = resolveConfigSchema(
  f.schema({
    name: f.string(''),
    count: f.number(1).range(0, 10),
    notes: f.list(['a']).label('Notes'),
    x: f.number(0).pair({ with: ['y'], label: 'Offset' }),
    y: f.number(0),
    own: f.string('').render((ctx) => <p data-testid="own">{ctx.error}</p>),
    g: f.group({ inner: f.boolean(false) }),
  }),
);
const config = { name: '', count: 1, notes: ['a'], x: 0, y: 0, own: '', g: { inner: false } };

function mount(errors: Record<string, string>) {
  renderWithIcons(
    <ControlPanel schema={schema} config={config} setConfig={vi.fn()} errors={errors} />,
  );
  return screen.queryAllByRole('alert').map((a) => a.textContent);
}

describe('<ControlPanel errors>', () => {
  it("shows each row's message under it, by the row's path", () => {
    expect(
      mount({
        name: 'needs a name',
        count: 'too many',
        notes: 'one is blank',
        'g.inner': 'not here',
      }),
    ).toEqual(['needs a name', 'too many', 'one is blank', 'not here']);
  });

  it("shows a paired cell's message under the pair", () => {
    expect(mount({ y: 'off the page' })).toEqual(['off the page']);
  });

  it('hands a custom row its message to draw', () => {
    mount({ own: 'mine' });
    expect(screen.getByTestId('own')).toHaveTextContent('mine');
  });

  it('draws no message for a row it names none for', () => {
    expect(mount({})).toEqual([]);
  });
});
