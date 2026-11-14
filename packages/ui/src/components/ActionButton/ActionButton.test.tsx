import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { Bar } from '../Bar/Bar';
import { ToolGroup } from '../ToolGroup/ToolGroup';
import { Disabled } from '../Disabled';
import { ActionButton } from './ActionButton';
import { FormScope } from './controlForm';

describe('ActionButton', () => {
  test('in a bar, draws its icon alone, named by its label', () => {
    render(
      <Bar label="History">
        <ActionButton label="Undo" icon={<i />} shortcut="⌘Z" onPress={() => {}} />
      </Bar>,
    );
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toHaveAttribute('data-form', 'bar');
    expect(undo.textContent).toBe('');
  });

  test('reads its words with no icon, or when labeled', () => {
    render(
      <Bar label="History">
        <ActionButton label="Save" onPress={() => {}} />
        <ActionButton label="Undo" icon={<i />} labeled onPress={() => {}} />
      </Bar>,
    );
    expect(screen.getByRole('button', { name: 'Save' }).textContent).toBe('Save');
    expect(screen.getByRole('button', { name: 'Undo' }).textContent).toBe('Undo');
  });

  test('shows the shortcut beside the label only in a menu row', () => {
    const { rerender } = render(<FormScope form="menu"><ActionButton label="Join" shortcut="⌘J" icon={<i />} onPress={() => {}} /></FormScope>);
    expect(screen.getByRole('button', { name: 'Join' }).textContent).toBe('Join⌘J');
    rerender(<ActionButton label="Join" shortcut="⌘J" icon={<i />} onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Join' }).textContent).toBe('');
  });

  test('draws its children in place of the label', () => {
    render(<ActionButton label="Zoom 100%, reset" onPress={() => {}}>100%</ActionButton>);
    expect(screen.getByRole('button', { name: 'Zoom 100%, reset' }).textContent).toBe('100%');
  });

  test('in a palette, reads label and shortcut under the icon, and marks the current tool', () => {
    render(
      <ToolGroup aria-label="Tools">
        <ActionButton label="Select" shortcut="V" icon={<i />} active onPress={() => {}} />
        <ActionButton label="Rect" icon={<i />} onPress={() => {}} />
      </ToolGroup>,
    );
    const select = screen.getByRole('button', { name: 'Select' });
    expect(select).toHaveAttribute('data-form', 'palette');
    expect(select).toHaveAttribute('aria-current', 'true');
    expect(select).not.toHaveAttribute('aria-pressed');
    expect(select.textContent).toBe('SelectV');
    expect(screen.getByRole('button', { name: 'Rect' })).not.toHaveAttribute('aria-current');
  });

  test('holds an active button down outside a palette', () => {
    render(<ActionButton label="Grid" active onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('marks a danger grade and runs its press', () => {
    const onPress = vi.fn();
    render(<ActionButton label="Discard" grade="danger" onPress={onPress} />);
    const discard = screen.getByRole('button', { name: 'Discard' });
    expect(discard).toHaveAttribute('data-grade', 'danger');
    discard.click();
    expect(onPress).toHaveBeenCalledOnce();
  });

  test('is natively disabled with no reason, and reachable with one', () => {
    render(
      <>
        <ActionButton label="Off" disabled onPress={() => {}} />
        <ActionButton label="Close" icon={<i />} disabled disabledReason="It is the last trial" onPress={() => {}} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Off' })).toBeDisabled();
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).not.toBeDisabled();
    expect(close).toHaveAttribute('aria-disabled', 'true');
    expect(close).toHaveAttribute('aria-description', 'It is the last trial');
  });

  test('refuses a press held by a Disabled scope with a reason', () => {
    const onPress = vi.fn();
    render(<Disabled when reason="Read the brief first"><ActionButton label="Go" onPress={onPress} /></Disabled>);
    const go = screen.getByRole('button', { name: 'Go' });
    expect(go).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(go);
    expect(onPress).not.toHaveBeenCalled();
  });

  test('is dead for a missing key, and says so', () => {
    const onPress = vi.fn();
    render(<ActionButton label="Flatten" missing="layers.flatten" onPress={onPress} />);
    const dead = screen.getByRole('button', { name: 'Flatten' });
    expect(dead).toHaveAttribute('aria-disabled', 'true');
    expect(dead).toHaveAttribute('data-missing', 'layers.flatten');
    fireEvent.click(dead);
    expect(onPress).not.toHaveBeenCalled();
  });

  test('says what it opens', () => {
    render(
      <>
        <ActionButton label="Settings" popup={{ type: 'dialog', expanded: true }} onPress={() => {}} />
        <ActionButton label="Shapes" popup={{ type: 'menu', expanded: false, id: 'shapes' }} onPress={() => {}} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-haspopup', 'dialog');
    const shapes = screen.getByRole('button', { name: 'Shapes' });
    expect(shapes).toHaveAttribute('aria-haspopup', 'menu');
    expect(shapes).toHaveAttribute('aria-expanded', 'false');
    expect(shapes).toHaveAttribute('id', 'shapes');
  });

  test('shows a preview while pointed at, and takes it down on leaving', () => {
    const down = vi.fn();
    const preview = vi.fn(() => down);
    render(<ActionButton label="Flip" preview={preview} onPress={() => {}} />);
    const flip = screen.getByRole('button', { name: 'Flip' });
    fireEvent.pointerEnter(flip);
    expect(preview).toHaveBeenCalledOnce();
    fireEvent.pointerLeave(flip);
    expect(down).toHaveBeenCalledOnce();
  });
});
