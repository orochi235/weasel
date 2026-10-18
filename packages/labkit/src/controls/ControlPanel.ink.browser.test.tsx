import '@weasel-js/theme/tokens.css';
import '../styles.less';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, test } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlMatrix } from './ControlMatrix';
import { ControlPanel } from './ControlPanel';

// Mounted on a page whose own ink is not the theme's, a panel's text has to be the theme's ink:
// only a browser resolves the `var()` that says which color that is.

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-wzl-mode');
});

const PAGE_INK = 'rgb(1, 2, 3)';

/** Renders `node` on a page inked `PAGE_INK`, and returns what the theme's `--wzl-fg` resolves to there. */
function onInkedPage(node: ReactNode): string {
  document.documentElement.setAttribute('data-wzl-mode', 'dark');
  const { container } = render(
    <div data-testid="page">
      <span data-testid="probe" />
      {node}
    </div>,
  );
  const page = screen.getByTestId('page');
  page.style.color = PAGE_INK;
  const probe = screen.getByTestId('probe');
  probe.style.color = 'var(--wzl-fg)';
  expect(container).toBeTruthy();
  return getComputedStyle(probe).color;
}

const schema = f.schema({ size: f.number(4).label('Size'), name: f.string('x').label('Name') });
const resolved = resolveConfigSchema(schema);
const config = schema.defaults() as Record<string, unknown>;

for (const title of [undefined, 'Shape']) {
  test(`a control panel ${title ? 'with' : 'without'} a title inks its text with the theme's fg`, () => {
    const fg = onInkedPage(
      <ControlPanel title={title} schema={resolved} config={config} setConfig={() => {}} />,
    );
    expect(fg).not.toBe(PAGE_INK);
    const root = screen.getByTestId('page').lastElementChild as HTMLElement;
    expect(getComputedStyle(root).color).toBe(fg);
  });
}

test("a control matrix inks its text with the theme's fg", () => {
  const look = () => ({ size: f.number(1) });
  const m = f.schema({ a: f.group(look()), b: f.group(look()) });
  const fg = onInkedPage(
    <ControlMatrix
      schema={resolveConfigSchema(m, [])}
      columns={[
        { key: 'a', label: 'A' },
        { key: 'b', label: 'B' },
      ]}
      rows={[{ key: 'size' }]}
      config={m.defaults() as Record<string, unknown>}
      auto={new Set()}
      setConfig={() => {}}
    />,
  );
  const root = screen.getByTestId('page').lastElementChild as HTMLElement;
  expect(getComputedStyle(root).color).toBe(fg);
});
