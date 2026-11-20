import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { AUTO } from '../config/auto';
import { f } from '../config/builder';
import { withConfigValueAt } from '../config/path';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

const pinned = (name: string) =>
  screen.getByRole('button', { name: `Pin ${name}` }).getAttribute('aria-pressed') === 'true';

function Panel({ schema }: { schema: ReturnType<typeof f.schema> }) {
  const [config, setConfig] = useState<Record<string, unknown>>(
    schema.defaults() as Record<string, unknown>,
  );
  return (
    <ControlPanel
      schema={resolveConfigSchema(schema, [])}
      config={config}
      setConfig={(path, value) => setConfig((prev) => withConfigValueAt(prev, path, value))}
      renderers={{
        go: (ctx) => (
          <button type="button" onClick={() => ctx.source.reset([''])}>
            Reset all
          </button>
        ),
      }}
    />
  );
}

describe('<ControlPanel> keeping its own auto set', () => {
  it('unpins every leaf a reset of several leaves writes in one event', () => {
    const schema = f.schema({
      a: f.number(1).range(0, 9).initial(AUTO).label('A'),
      b: f.number(2).range(0, 9).initial(AUTO).label('B'),
      go: f.string(''),
    });
    render(<Panel schema={schema} />);
    expect(pinned('A')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Pin A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pin B' }));
    expect([pinned('A'), pinned('B')]).toEqual([true, true]);
    fireEvent.click(screen.getByRole('button', { name: 'Reset all' }));
    expect([pinned('A'), pinned('B')]).toEqual([false, false]);
  });

  it('starts a schema of other leaves from its own start-auto set', () => {
    const first = f.schema({ a: f.number(1).range(0, 9).initial(AUTO).label('A') });
    const second = f.schema({
      a: f.number(1).range(0, 9).auto().label('A'),
      b: f.number(2).range(0, 9).initial(AUTO).label('B'),
    });
    const draw = (schema: ReturnType<typeof f.schema>) => (
      <ControlPanel schema={resolveConfigSchema(schema, [])} config={{}} setConfig={() => {}} />
    );
    const { rerender } = render(draw(first));
    expect(pinned('A')).toBe(false);
    rerender(draw(second));
    expect([pinned('A'), pinned('B')]).toEqual([true, false]);
  });

  it('keeps its pins across a render that resolves the same schema afresh', () => {
    const schema = f.schema({ a: f.number(1).range(0, 9).initial(AUTO).label('A') });
    const draw = () => (
      <ControlPanel schema={resolveConfigSchema(schema, [])} config={{}} setConfig={() => {}} />
    );
    const { rerender } = render(draw());
    fireEvent.click(screen.getByRole('button', { name: 'Pin A' }));
    rerender(draw());
    expect(pinned('A')).toBe(true);
  });
});
