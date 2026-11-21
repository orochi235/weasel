import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { MenuEntry } from '@weasel-js/menu';
import { useMenuTrigger, type MenuTrigger } from './useMenuTrigger';

afterEach(cleanup);

it('gives focus back to the button of a silently opened menu that closes while its color picker has focus', () => {
  const entries: MenuEntry[] = [{ kind: 'color', key: 'fill', label: 'Fill', value: '#336699', set: () => {} }];
  let trigger: MenuTrigger | null = null;
  function Bar() {
    const t = useMenuTrigger();
    trigger = t;
    return <><button ref={t.button} id={t.id}>Format</button>{t.anchor}{t.portal}</>;
  }
  render(<Bar />);
  act(() => { trigger!.show(entries, 'pointer', true); });
  fireEvent.click(screen.getByRole('menuitem', { name: /^Fill/ }));
  const input = screen.getByLabelText('Fill', { selector: 'input[type="color"]' });
  act(() => { input.focus(); });
  expect(document.activeElement).toBe(input);
  act(() => { trigger!.close(); });
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Format' }));
});

it('gives focus back to the button of a silently opened menu dismissed while one of its fields has focus', () => {
  const set = vi.fn();
  const entries: MenuEntry[] = [{ kind: 'text', key: 'name', label: 'Name', value: 'Layer 1', set }];
  let trigger: MenuTrigger | null = null;
  function Bar() {
    const t = useMenuTrigger();
    trigger = t;
    return <><button ref={t.button} id={t.id}>Format</button>{t.anchor}{t.portal}</>;
  }
  render(<Bar />);
  act(() => { trigger!.show(entries, 'pointer', true); });
  const field = screen.getByRole('textbox', { name: 'Name' });
  act(() => { field.focus(); });
  act(() => { fireEvent.change(field, { target: { value: 'Layer 2' } }); });
  act(() => { fireEvent(window, new Event('resize')); });
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Format' }));
  expect(set).toHaveBeenCalledExactlyOnceWith('Layer 2');
});
