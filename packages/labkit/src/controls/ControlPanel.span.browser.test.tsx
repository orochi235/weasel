import '@weasel-js/theme/tokens.css';
import '../styles.less';
import { cleanup, render, screen } from '@testing-library/react';
import { PropertyRow } from '@weasel-js/ui/components/Properties';
import { afterEach, expect, test } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

// Whether a row takes half of the two-column grid or all of it is layout, which only a browser has.

afterEach(cleanup);

const schema = f.schema({
  a: f.number(1).label('A'),
  custom: f.number(2).render(() => (
    <PropertyRow label="Drawn">
      <span data-testid="drawn">by hand</span>
    </PropertyRow>
  )),
  b: f.number(3).label('B'),
  tools: f.group({ bold: f.boolean(false), size: f.number(12) }).as('bar'),
  c: f.number(4).label('C'),
});

test('a custom row and a bar take the whole width of a paired grid', () => {
  const { container } = render(
    <div style={{ width: '480px' }}>
      <ControlPanel
        schema={resolveConfigSchema(schema, [])}
        config={schema.defaults() as Record<string, unknown>}
        setConfig={() => {}}
        pack="pairs"
      />
    </div>,
  );
  const list = container.querySelector('.lk-control-panel') as HTMLElement;
  const full = list.getBoundingClientRect().width;
  const widthOf = (el: Element): number => {
    let at: Element | null = el;
    while (at && at.parentElement !== list) at = at.parentElement;
    return (at as HTMLElement).getBoundingClientRect().width;
  };
  expect(widthOf(screen.getByRole('spinbutton', { name: 'A' }))).toBeLessThan(full * 0.6);
  expect(widthOf(screen.getByTestId('drawn'))).toBeCloseTo(full, 0);
  expect(widthOf(screen.getByRole('toolbar'))).toBeCloseTo(full, 0);
});

test('a panel too narrow for two columns gives every row the whole width', () => {
  const pairs = f.schema({ a: f.number(1).label('A'), b: f.number(2).label('B') });
  const at = (width: string) => {
    const { container } = render(
      <div style={{ width }}>
        <ControlPanel
          schema={resolveConfigSchema(pairs, [])}
          config={pairs.defaults() as Record<string, unknown>}
          setConfig={() => {}}
        />
      </div>,
    );
    const list = container.querySelector('.lk-control-panel') as HTMLElement;
    const a = screen.getByRole('spinbutton', { name: 'A' }).closest('label') as HTMLElement;
    const b = screen.getByRole('spinbutton', { name: 'B' }).closest('label') as HTMLElement;
    const shape = {
      full: list.getBoundingClientRect().width,
      a: a.getBoundingClientRect(),
      b: b.getBoundingClientRect(),
    };
    cleanup();
    return shape;
  };
  const wide = at('320px');
  expect(wide.a.width).toBeLessThan(wide.full * 0.6);
  expect(wide.b.top).toBeCloseTo(wide.a.top, 0);
  const narrow = at('160px');
  expect(narrow.a.width).toBeCloseTo(narrow.full, 0);
  expect(narrow.b.top).toBeGreaterThan(narrow.a.bottom - 1);
});
