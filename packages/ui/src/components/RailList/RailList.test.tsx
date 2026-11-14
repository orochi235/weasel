import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from 'react-aria-components';
import { describe, expect, it, vi } from 'vitest';
import { RailItem, RailList, RailListBox, RailName, RailOption, RailSection } from './index';

describe('RailList', () => {
  it('holds buttons, the current one marked as the open page', async () => {
    const onClick = vi.fn();
    render(
      <RailList aria-label="Pages">
        <RailItem current onClick={onClick}><RailName>Canvas</RailName></RailItem>
        <RailItem>Export</RailItem>
      </RailList>,
    );
    const canvas = screen.getByRole('button', { name: 'Canvas' });
    expect(canvas.getAttribute('aria-current')).toBe('page');
    expect(canvas.getAttribute('data-rail-mark')).toBe('current');
    expect(canvas.getAttribute('type')).toBe('button');
    const exp = screen.getByRole('button', { name: 'Export' });
    expect(exp.hasAttribute('aria-current')).toBe(false);
    expect(exp.hasAttribute('data-rail-mark')).toBe(false);
    await userEvent.click(canvas);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('names another kind of current where it is given one', () => {
    render(<RailList><RailItem current="step">Two</RailItem></RailList>);
    expect(screen.getByRole('button', { name: 'Two' }).getAttribute('aria-current')).toBe('step');
  });

  it('keeps a consumer class beside its own', () => {
    render(<RailList><RailItem className="mine">One</RailItem></RailList>);
    expect(screen.getByRole('button', { name: 'One' }).classList.contains('mine')).toBe(true);
  });
});

describe('RailListBox', () => {
  function Assets({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
    return (
      <RailListBox aria-label="Assets" selectionMode="single" selectedKeys={[selected]}
        onSelectionChange={(keys) => { if (keys !== 'all') onSelect(String([...keys][0])); }}>
        <RailSection guide>
          <Header>Dialogs</Header>
          {['Main', 'Export'].map((id) => (
            <RailOption key={id} id={id} textValue={id} current={id === selected}>
              <RailName slot="label">{id}</RailName>
            </RailOption>
          ))}
        </RailSection>
      </RailListBox>
    );
  }

  it('is a listbox of options under a section, the shown one marked current', () => {
    render(<Assets selected="Main" onSelect={() => {}} />);
    expect(screen.getByRole('listbox', { name: 'Assets' })).toBeTruthy();
    expect(screen.getByRole('group')).toBeTruthy();
    const main = screen.getByRole('option', { name: 'Main' });
    expect(main.getAttribute('data-rail-mark')).toBe('current');
    expect(main.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('option', { name: 'Export' }).hasAttribute('data-rail-mark')).toBe(false);
  });

  it('selects the option a reader picks', async () => {
    const onSelect = vi.fn();
    render(<Assets selected="Main" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('option', { name: 'Export' }));
    expect(onSelect).toHaveBeenCalledWith('Export');
  });
});
