import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Button } from '../Button';
import { Checkbox } from '../Checkbox';
import { Input } from '../Input';
import { Select } from '../Select';
import { Switch } from '../Switch';
import { SegmentedBar } from '../Segmented';
import { Toolbar } from '../Toolbar';
import { Disabled, ReadOnly, useDisabled } from './Disabled';

function Probe(props: { disabled?: boolean; disabledReason?: string }) {
  const { disabled, reason } = useDisabled(props);
  return <output>{`${disabled}:${reason ?? ''}`}</output>;
}

describe('Disabled', () => {
  it('disables everything inside, and an inner disabled={false} adds nothing', () => {
    render(<Disabled reason="Locked"><Probe disabled={false} /></Disabled>);
    expect(screen.getByRole('status').textContent).toBe('true:Locked');
  });

  it('takes the nearest reason, and a control own reason beats the scope', () => {
    const { rerender } = render(<Disabled reason="Locked"><Disabled reason="Busy"><Probe /></Disabled></Disabled>);
    expect(screen.getByRole('status').textContent).toBe('true:Busy');
    rerender(<Disabled reason="Locked"><Probe disabled disabledReason="Nothing selected" /></Disabled>);
    expect(screen.getByRole('status').textContent).toBe('true:Nothing selected');
  });

  it('does nothing when `when` is false', () => {
    render(<Disabled when={false} reason="Locked"><Probe /></Disabled>);
    expect(screen.getByRole('status').textContent).toBe('false:');
  });

  it('natively disables a button with no reason anywhere', () => {
    const onClick = vi.fn();
    render(<Disabled><Button onClick={onClick}>Save</Button></Disabled>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('keeps a button with a reason reachable, refusing presses and describing why', () => {
    const onClick = vi.fn();
    render(<Disabled reason="Locked"><Button onClick={onClick}>Save</Button></Disabled>);
    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('aria-description')).toBe('Locked');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is what a container disabled prop does', () => {
    render(<Toolbar disabled disabledReason="Locked"><Button>Save</Button></Toolbar>);
    expect(screen.getByRole('button').getAttribute('aria-disabled')).toBe('true');
  });

  it('reaches React Aria fields, translated once', () => {
    render(<Disabled><Input aria-label="Name" /><Switch>Snap</Switch></Disabled>);
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('keeps a field with a reason focusable and describes why', () => {
    render(<Disabled reason="Locked"><Input aria-label="Name" /></Disabled>);
    const box = screen.getByRole('textbox');
    expect(box).not.toBeDisabled();
    expect(box).toHaveAttribute('readonly');
    expect(box).toHaveAccessibleDescription('Locked');
    act(() => box.focus());
    expect(screen.getByRole('tooltip').textContent).toBe('Locked');
  });

  it('keeps a select with a reason focusable, and its list shut', () => {
    render(<Disabled reason="Locked"><Select aria-label="Color" options={[{ value: 'r', label: 'Red' }]} /></Disabled>);
    const trigger = screen.getByRole('button');
    expect(trigger).not.toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('ReadOnly', () => {
  it('gives a text field native readOnly', () => {
    render(<ReadOnly reason="Shared"><Input aria-label="Name" defaultValue="Pico" /></ReadOnly>);
    const box = screen.getByRole('textbox');
    expect(box).toHaveAttribute('readonly');
    expect(box).not.toBeDisabled();
  });

  it('keeps a checkbox focusable, aria-readonly, and refuses changes', () => {
    const onChange = vi.fn();
    render(<ReadOnly><Checkbox onChange={onChange}>Snap</Checkbox></ReadOnly>);
    const box = screen.getByRole('checkbox');
    expect(box.getAttribute('aria-readonly')).toBe('true');
    fireEvent.click(box);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('holds a single-mode SegmentedBar but not an action button', () => {
    const onChange = vi.fn();
    const onClick = vi.fn();
    render(
      <ReadOnly reason="Shared">
        <SegmentedBar items={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} value="a" onChange={onChange} />
        <Button onClick={onClick}>Export</Button>
      </ReadOnly>,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'B' }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(onClick).toHaveBeenCalled();
  });

  it('loses to disabled', () => {
    render(<ReadOnly><Disabled><Input aria-label="Name" /></Disabled></ReadOnly>);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
