import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { withValueAtPath } from '../config/path';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';
import { summarizeValue } from './inDialog';

function Panel({ schema }: { schema: Parameters<typeof resolveConfigSchema>[0] }) {
  const resolved = resolveConfigSchema(schema);
  const [config, setConfig] = useState<Record<string, unknown>>(
    schema.defaults() as Record<string, unknown>,
  );
  return (
    <>
      <ControlPanel
        schema={resolved}
        config={config}
        setConfig={(path, value) => setConfig((prev) => withValueAtPath(prev, path, value))}
      />
      <output data-testid="config">{JSON.stringify(config)}</output>
    </>
  );
}

describe('f.list', () => {
  it('summarizes the list on the row and edits it in a dialog', () => {
    const schema = f.schema({
      icons: f.list(['**/node_modules/**', 'dist']).label('Draw as icons'),
    });
    render(<Panel schema={schema} />);
    const trigger = screen.getByRole('button', { name: 'Edit Draw as icons' });
    expect(trigger.textContent).toContain('**/node_modules/**, dist');

    fireEvent.click(trigger);
    fireEvent.change(screen.getByRole('textbox', { name: 'Draw as icons 2' }), {
      target: { value: 'build' },
    });
    expect(screen.getByTestId('config').textContent).toBe(
      JSON.stringify({ icons: ['**/node_modules/**', 'build'] }),
    );
  });

  it('is the kind an f.value with a string-array default takes', () => {
    const resolved = resolveConfigSchema(f.schema({ names: f.value(['a']) }));
    expect(resolved.group.children.names).toMatchObject({ kind: 'list' });
  });
});

describe('.dialog', () => {
  it('hosts any renderer in the dialog, handed the row context', () => {
    const schema = f.schema({
      note: f.string('hi').dialog(({ value, setValue }) => (
        <button type="button" onClick={() => setValue(`${value}!`)}>
          shout
        </button>
      )),
    });
    render(<Panel schema={schema} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Note' }));
    fireEvent.click(screen.getByRole('button', { name: 'shout' }));
    expect(screen.getByTestId('config').textContent).toBe(JSON.stringify({ note: 'hi!' }));
  });

  it('takes a summary of its own', () => {
    const summary = vi.fn((v: unknown) => `${(v as number[]).length} points`);
    const schema = f.schema({ pts: f.custom('points', [1, 2, 3]).dialog(() => null, { summary }) });
    render(<Panel schema={schema} />);
    expect(screen.getByRole('button', { name: 'Edit Pts' }).textContent).toContain('3 points');
  });

  it('gives way to a later .render, and takes over from an earlier one', () => {
    const schema = f.schema({
      a: f
        .string('x')
        .dialog(() => null)
        .render(() => <span>row a</span>),
      b: f
        .string('y')
        .render(() => <span>row b</span>)
        .dialog(() => null),
    });
    render(<Panel schema={schema} />);
    expect(screen.getByText('row a')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit A' })).toBeNull();
    expect(screen.queryByText('row b')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit B' })).toBeTruthy();
  });
});

describe('summarizeValue', () => {
  it('joins lists and names emptiness', () => {
    expect(summarizeValue(['a', 'b'])).toBe('a, b');
    expect(summarizeValue([])).toBe('None');
    expect(summarizeValue('')).toBe('None');
    expect(summarizeValue(3)).toBe('3');
    expect(summarizeValue({ a: 1 })).toBe('{"a":1}');
  });
});
