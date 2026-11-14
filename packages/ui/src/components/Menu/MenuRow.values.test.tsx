import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { MenuColorEntry, MenuEntry, MenuNumberEntry, MenuTextEntry } from '@weasel-js/menu';
import { percent } from '@weasel-js/quantity';
import { OpenPanels } from './ContextMenuHost';

afterEach(cleanup);

function open(extra: Partial<MenuNumberEntry> = {}) {
  const set = vi.fn();
  const close = vi.fn();
  const entries: MenuEntry[] = [
    { kind: 'item', key: 'cut', label: 'Cut', run: () => {} },
    { kind: 'number', key: 'zoom', label: 'Magnification', value: 8, min: 2, max: 16, step: 1, suffix: '×', set, ...extra },
    { kind: 'color', key: 'color', label: 'Color', value: '#336699' },
  ];
  render(<OpenPanels open={{ seq: 1, entries, client: { x: 0, y: 0 }, source: 'keyboard' }} close={close} />);
  return { set, close, menu: screen.getByRole('menu') };
}

const field = () => screen.getByRole('spinbutton', { name: 'Magnification' });
const key = (el: Element, k: string) => act(() => { fireEvent.keyDown(el, { key: k }); });

describe('a number row in a DOM menu', () => {
  it('is a menu item holding a field named for it, showing its value and unit', () => {
    open();
    const row = screen.getByRole('menuitem', { name: /Magnification/ });
    expect(row).toContainElement(field());
    expect(field()).toHaveValue('8');
    expect(field()).toHaveAttribute('aria-valuemin', '2');
    expect(field()).toHaveAttribute('aria-valuemax', '16');
    expect(row.textContent).toContain('×');
  });

  it('commits a typed value without closing the menu', () => {
    const { set, close } = open();
    act(() => {
      fireEvent.change(field(), { target: { value: '12' } });
      fireEvent.blur(field());
    });
    expect(set).toHaveBeenCalledWith(12);
    expect(field()).toHaveValue('12');
    expect(close).not.toHaveBeenCalled();
  });

  it('steps with the arrow keys while the field has focus, and the highlight stays put', () => {
    const { set, menu } = open();
    const before = menu.getAttribute('aria-activedescendant');
    key(field(), 'ArrowUp');
    key(field(), 'ArrowUp');
    expect(set.mock.calls).toEqual([[9], [10]]);
    expect(field()).toHaveValue('10');
    expect(menu.getAttribute('aria-activedescendant')).toBe(before);
  });

  it('is reached by the arrow keys, steps with + and -, and takes focus on Enter', () => {
    const { set, menu, close } = open();
    key(menu, 'ArrowDown');
    expect(menu.getAttribute('aria-activedescendant')).toBe(screen.getByRole('menuitem', { name: /Magnification/ }).id);
    key(menu, '+');
    expect(set).toHaveBeenLastCalledWith(9);
    expect(field()).toHaveValue('9');
    key(menu, 'Enter');
    expect(document.activeElement).toBe(field());
    key(field(), 'Escape');
    expect(document.activeElement).toBe(menu);
    expect(close).not.toHaveBeenCalled();
  });

  it('shows its value in the display it carries', () => {
    open({ value: 0.5, min: 0, max: 1, step: 0.01, display: percent() });
    expect(field()).toHaveValue('50%');
  });

  it('reads a typed value in any unit it accepts', () => {
    const { set } = open({ value: 10, min: 0, max: 100, suffix: 'cm', accepts: { cm: 1, mm: 0.1 } });
    act(() => {
      fireEvent.change(field(), { target: { value: '12mm' } });
      fireEvent.blur(field());
    });
    expect(set).toHaveBeenCalledWith(1.2);
  });

  it('takes infinity typed at an endless end, and shows its word for it without the unit', () => {
    const { set } = open({ endless: 'max', infinity: 'uncapped' });
    act(() => {
      fireEvent.change(field(), { target: { value: 'uncapped' } });
      fireEvent.blur(field());
    });
    expect(set).toHaveBeenCalledWith(Infinity);
    expect(field()).toHaveValue('uncapped');
    expect(screen.getByRole('menuitem', { name: /Magnification/ }).textContent).not.toContain('×');
  });

  it('cannot be edited while disabled', () => {
    open({ disabled: true });
    expect(screen.getByRole('menuitem', { name: /Magnification/ })).toHaveAttribute('aria-disabled', 'true');
    expect(field()).toBeDisabled();
  });
});

describe('a color row in a DOM menu', () => {
  function openColor(extra: Partial<MenuColorEntry> = {}) {
    const set = vi.fn();
    const close = vi.fn();
    const entries: MenuEntry[] = [
      { kind: 'item', key: 'cut', label: 'Cut', run: () => {} },
      { kind: 'color', key: 'fill', label: 'Fill', value: '#336699', set, ...extra },
    ];
    render(<OpenPanels open={{ seq: 1, entries, client: { x: 0, y: 0 }, source: 'keyboard' }} close={close} />);
    return { set, close, menu: screen.getByRole('menu'), row: screen.getByRole('menuitem', { name: /^Fill/ }) };
  }
  const picker = () => screen.queryByRole('dialog', { name: 'Fill color' });
  const swatchInput = () => screen.getByLabelText('Fill', { selector: 'input[type="color"]' });

  it('opens the color field in a popover when pressed, and writes what it commits without closing', () => {
    const { set, close, row } = openColor();
    expect(row).not.toHaveAttribute('aria-disabled');
    expect(row).toHaveAttribute('aria-haspopup', 'dialog');
    expect(picker()).toBeNull();
    fireEvent.click(row);
    expect(picker()).not.toBeNull();
    expect(row).toHaveAttribute('aria-expanded', 'true');
    act(() => {
      fireEvent.pointerDown(swatchInput());
      fireEvent.input(swatchInput(), { target: { value: '#ff0000' } });
      fireEvent.change(swatchInput());
    });
    expect(set).toHaveBeenCalledExactlyOnceWith('#ff0000');
    expect(row.textContent).toContain('#ff0000');
    expect(close).not.toHaveBeenCalled();
  });

  it('opens on Enter while highlighted, and Escape closes only the popover', () => {
    const { close, menu, row } = openColor();
    key(menu, 'ArrowDown');
    expect(menu.getAttribute('aria-activedescendant')).toBe(row.id);
    key(menu, 'Enter');
    expect(picker()).not.toBeNull();
    key(swatchInput(), 'Escape');
    expect(picker()).toBeNull();
    expect(close).not.toHaveBeenCalled();
  });

  it('offers opacity when the entry has alpha', () => {
    const { row } = openColor({ alpha: true });
    fireEvent.click(row);
    expect(within(picker()!).getByRole('slider')).toBeInTheDocument();
  });

  it('stays open when the window blurs while its color input has focus', () => {
    const { close, row } = openColor();
    fireEvent.click(row);
    act(() => { swatchInput().focus(); });
    act(() => { window.dispatchEvent(new Event('blur')); });
    expect(close).not.toHaveBeenCalled();
  });

  it('opens nothing while disabled', () => {
    const { row } = openColor({ disabled: true });
    fireEvent.click(row);
    expect(picker()).toBeNull();
  });

  it('is a disabled menu item showing a swatch and the hex when it has no set', () => {
    const { close } = open();
    const row = screen.getByRole('menuitem', { name: /^Color\s*#336699$/ });
    expect(row).toHaveAttribute('aria-disabled', 'true');
    expect(row.querySelector('[aria-hidden="true"][style]')?.getAttribute('style')).toContain('#336699');
    fireEvent.click(row);
    expect(close).not.toHaveBeenCalled();
  });
});

describe('a text row in a DOM menu', () => {
  function openText(extra: Partial<MenuTextEntry> = {}) {
    const set = vi.fn();
    const close = vi.fn();
    const entries: MenuEntry[] = [
      { kind: 'item', key: 'cut', label: 'Cut', run: () => {} },
      { kind: 'text', key: 'name', label: 'Name', value: 'Layer 1', set, ...extra },
    ];
    render(<OpenPanels open={{ seq: 1, entries, client: { x: 0, y: 0 }, source: 'keyboard' }} close={close} />);
    return { set, close, menu: screen.getByRole('menu') };
  }
  const box = () => screen.getByRole('textbox', { name: 'Name' });

  it('is a menu item holding a text field named for it, showing its value', () => {
    openText();
    expect(screen.getByRole('menuitem', { name: /Name/ })).toContainElement(box());
    expect(box()).toHaveValue('Layer 1');
  });

  it('commits what is typed on Enter, gives focus back, and stays open', () => {
    const { set, close, menu } = openText();
    act(() => { box().focus(); });
    act(() => { fireEvent.change(box(), { target: { value: 'Layer 2' } }); });
    expect(set).not.toHaveBeenCalled();
    key(box(), 'Enter');
    expect(set).toHaveBeenCalledExactlyOnceWith('Layer 2');
    expect(document.activeElement).toBe(menu);
    expect(box()).toHaveValue('Layer 2');
    expect(close).not.toHaveBeenCalled();
  });

  it('leaves an input method\'s Enter and Escape to it, Safari\'s closing Enter included', () => {
    const { set, close } = openText();
    act(() => { box().focus(); });
    act(() => { fireEvent.change(box(), { target: { value: 'にほ' } }); });
    for (const init of [{ key: 'Enter', isComposing: true }, { key: 'Enter', keyCode: 229 }, { key: 'Escape', isComposing: true }]) {
      act(() => { fireEvent.keyDown(box(), init); });
    }
    expect(set).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(box());
    expect(box()).toHaveValue('にほ');
    expect(close).not.toHaveBeenCalled();
  });

  it('commits on blur', () => {
    const { set } = openText();
    act(() => {
      fireEvent.change(box(), { target: { value: 'Layer 3' } });
      fireEvent.blur(box());
    });
    expect(set).toHaveBeenCalledWith('Layer 3');
  });

  it('puts the value back on Escape, writing nothing, and the menu stays open', () => {
    const { set, close, menu } = openText();
    act(() => { box().focus(); });
    act(() => { fireEvent.change(box(), { target: { value: 'oops' } }); });
    key(box(), 'Escape');
    expect(set).not.toHaveBeenCalled();
    expect(box()).toHaveValue('Layer 1');
    expect(document.activeElement).toBe(menu);
    expect(close).not.toHaveBeenCalled();
  });

  it('takes focus on Enter while highlighted, and typing into it is not typeahead', () => {
    const { menu } = openText();
    key(menu, 'ArrowDown');
    const row = screen.getByRole('menuitem', { name: /Name/ });
    expect(menu.getAttribute('aria-activedescendant')).toBe(row.id);
    key(menu, 'Enter');
    expect(document.activeElement).toBe(box());
    key(box(), 'c');
    expect(menu.getAttribute('aria-activedescendant')).toBe(row.id);
  });

  it('cannot be edited while disabled', () => {
    openText({ disabled: true });
    expect(screen.getByRole('menuitem', { name: /Name/ })).toHaveAttribute('aria-disabled', 'true');
    expect(box()).toBeDisabled();
  });
});
