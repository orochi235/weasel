import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

const schema = resolveConfigSchema(
  f.schema({
    note: f.string('hi').dialog(({ value, setValue }) => (
      <>
        <output>{String(value)}</output>
        <button type="button" onClick={() => setValue(`${value}!`)}>
          shout
        </button>
      </>
    )),
    names: f.list(['a', 'b']).label('Names'),
  }),
);

function mount() {
  const setConfig = vi.fn();
  renderWithIcons(
    <ControlPanel
      schema={schema}
      config={{ note: 'hi', names: ['a', 'b'] }}
      setConfig={setConfig}
    />,
  );
  return setConfig;
}

const open = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name: `Edit ${name}` }));

describe('a .dialog row', () => {
  it('holds its edits until Done, then writes them once', () => {
    const setConfig = mount();
    open('Note');
    fireEvent.click(screen.getByRole('button', { name: 'shout' }));
    fireEvent.click(screen.getByRole('button', { name: 'shout' }));
    expect(within(screen.getByRole('dialog')).getByText('hi!!')).toBeInTheDocument();
    expect(setConfig).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(setConfig.mock.calls).toEqual([['note', 'hi!!']]);
  });

  it('drops its edits on Cancel and on Escape, and opens again on the stored value', () => {
    const setConfig = mount();
    open('Note');
    fireEvent.click(screen.getByRole('button', { name: 'shout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    open('Note');
    expect(within(screen.getByRole('dialog')).getByText('hi')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'shout' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'shout' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(setConfig).not.toHaveBeenCalled();
  });

  it('writes nothing on Done when nothing was edited', () => {
    const setConfig = mount();
    open('Note');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(setConfig).not.toHaveBeenCalled();
  });
});

describe("a compound leaf's dialog", () => {
  it('holds its edits the same way', () => {
    const setConfig = mount();
    open('Names');
    fireEvent.change(screen.getByRole('textbox', { name: 'Names 2' }), { target: { value: 'c' } });
    fireEvent.blur(screen.getByRole('textbox', { name: 'Names 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(setConfig).not.toHaveBeenCalled();
    open('Names');
    fireEvent.change(screen.getByRole('textbox', { name: 'Names 2' }), { target: { value: 'c' } });
    fireEvent.blur(screen.getByRole('textbox', { name: 'Names 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(setConfig.mock.calls).toEqual([['names', ['a', 'c']]]);
  });
});
