import { fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { withValueAtPath } from '../config/path';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

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

const config = (): unknown => JSON.parse(screen.getByTestId('config').textContent ?? '');
const open = (label: string): void => {
  fireEvent.click(screen.getByRole('button', { name: `Edit ${label}` }));
};
const done = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
};

describe('a control panel row for a leaf made of other leaves', () => {
  it('edits one field of an object in a dialog and writes the object whole', () => {
    renderWithIcons(
      <Panel schema={f.schema({ stop: f.object({ on: f.boolean(false), at: f.number(1) }) })} />,
    );
    open('Stop');
    fireEvent.click(screen.getByRole('checkbox', { name: 'On' }));
    done();
    expect(config()).toEqual({ stop: { on: true, at: 1 } });
  });

  it('edits one entry of a typed list', () => {
    renderWithIcons(
      <Panel schema={f.schema({ flags: f.list([false, false], f.boolean(true).label('Flag')) })} />,
    );
    open('Flags');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Flag 2' }));
    done();
    expect(config()).toEqual({ flags: [false, true] });
  });

  it('edits one value of a map under its key', () => {
    renderWithIcons(
      <Panel
        schema={f.schema({
          on: f.map({ left: false, right: false }, f.boolean(true).label('Flag')),
        })}
      />,
    );
    open('On');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Flag right' }));
    done();
    expect(config()).toEqual({ on: { left: false, right: true } });
  });

  it("edits a field of a union's variant, keeping the tag", () => {
    const schema = f.schema({
      ramp: f.union('type', {
        linear: f.object({ soft: f.boolean(false) }),
        radial: f.object({ wide: f.boolean(false) }),
      }),
    });
    renderWithIcons(<Panel schema={schema} />);
    open('Ramp');
    expect(screen.queryByRole('checkbox', { name: 'Wide' })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Soft' }));
    done();
    expect(config()).toEqual({ ramp: { type: 'linear', soft: true } });
  });

  it('runs an action from its row', () => {
    const run = vi.fn();
    renderWithIcons(<Panel schema={f.schema({ wipe: f.action(run) })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Wipe' }));
    expect(run).toHaveBeenCalledWith({ path: 'wipe' });
  });
});

describe('a control panel row for a list of strings', () => {
  it('draws each entry as a textarea when the item asks for one', () => {
    const schema = f.schema({ notes: f.list(['a'], f.string('')) });
    const resolved = resolveConfigSchema(schema);
    const list = resolved.group.children.notes as unknown as { item: { control?: string } };
    list.item.control = 'textarea';
    renderWithIcons(
      <ControlPanel schema={resolved} config={{ notes: ['a'] }} setConfig={() => {}} />,
    );
    open('Notes');
    expect(document.querySelector('textarea')).not.toBeNull();
  });
});
