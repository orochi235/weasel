import { render } from '@testing-library/react';
import { PropertySpan } from '@weasel-js/ui/components/Properties';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

// A pairs group's body sets every child to one column, at a specificity no labkit class reaches, so a row that
// takes the whole width has to carry ui's span class. jsdom lays out no grid: the class is the proxy.
const spanClass = (() => {
  const { container } = render(<PropertySpan>x</PropertySpan>);
  const name = (container.firstChild as HTMLElement).className;
  container.remove();
  return name;
})();

const schema = resolveConfigSchema(
  f.schema({
    look: f.group({
      size: f.number(6),
      curve: f.custom('curve', [0, 1]),
      note: f.label('About the look'),
      again: f.action(() => {}).label('Again'),
    }),
  }),
  [],
);
const config = { look: { size: 6, curve: [0, 1] } };

describe('<ControlPanel> rows that take the whole width', () => {
  it('spans a renderer, a label and an action inside a pairs group', () => {
    const { container } = render(
      <ControlPanel
        schema={schema}
        config={config}
        setConfig={vi.fn()}
        renderers={{ curve: () => <span>curve</span> }}
      />,
    );
    for (const cls of ['lk-control-custom', 'lk-control-words', 'lk-control-actions']) {
      expect(container.querySelector(`.${cls}`), cls).toHaveClass(spanClass);
    }
  });
});

describe('<ControlPanel> groups drawn whole-width', () => {
  it('spans a bar and a run of tabs inside a pairs group', () => {
    const nested = resolveConfigSchema(
      f.schema({
        look: f.group({
          size: f.number(6),
          strip: f.group({ a: f.boolean(true) }).as('bar'),
          one: f
            .group({ b: f.number(1) })
            .label('One')
            .as('tab'),
          two: f
            .group({ c: f.number(2) })
            .label('Two')
            .as('tab'),
        }),
      }),
      [],
    );
    const { container } = render(
      <ControlPanel
        schema={nested}
        config={{ look: { size: 6, strip: { a: true }, one: { b: 1 }, two: { c: 2 } } }}
        setConfig={vi.fn()}
      />,
    );
    for (const cls of ['lk-control-bar', 'lk-control-tabs']) {
      expect(container.querySelector(`.${cls}`)?.parentElement, cls).toHaveClass(spanClass);
    }
  });
});
