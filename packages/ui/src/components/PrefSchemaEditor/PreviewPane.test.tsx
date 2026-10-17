import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { ActionsProvider, useCommand } from '@weasel-js/core';
import type { PrefGroup, PrefSection } from '@weasel-js/prefs';
import { PreviewPane } from './PreviewPane';

afterEach(cleanup);

describe('the preview of a node property schema', () => {
  it('reports only the value that was edited, not a default its scratch node has no place for', () => {
    const schema: PrefSection = {
      name: 'Rect',
      members: {
        'data.text': { kind: 'string', name: 'Text', description: '', default: 'hello' },
        lineWidth: { kind: 'number', name: 'Line width', description: '', default: 3 },
        kind: { kind: 'string', name: 'Kind', description: '', default: 'rect' },
      },
    };
    const onDefaults = vi.fn();
    render(<PreviewPane schema={schema} onDefaults={onDefaults} />);
    const text = screen.getByRole('textbox', { name: 'Text' });
    fireEvent.change(text, { target: { value: 'typed' } });
    fireEvent.blur(text);
    expect(onDefaults).toHaveBeenLastCalledWith([[['data', 'text'], 'typed']]);
  });
});

function Command() {
  useCommand('file.open', 'Open', () => {});
  return null;
}

describe('the preview of a menu root', () => {
  const menu = (action: string): PrefGroup => ({
    name: 'File', description: '', as: 'menu',
    children: { open: { kind: 'action', action, name: '', description: '', default: undefined } },
  });

  it('previews a menu root open', async () => {
    const schema = menu('file.open');
    await renderSettled(<ActionsProvider><Command /><PreviewPane schema={schema} onDefaults={vi.fn()} /></ActionsProvider>);
    expect(screen.getByRole('menuitem', { name: 'Open' })).toBeDefined();
  });

  it('reopens the preview with the edited rows', async () => {
    function Commands() {
      useCommand('file.open', 'Open', () => {});
      useCommand('file.save', 'Save', () => {});
      return null;
    }
    const ui = (schema: PrefGroup) => <ActionsProvider><Commands /><PreviewPane schema={schema} onDefaults={vi.fn()} /></ActionsProvider>;
    const { rerender } = await renderSettled(ui(menu('file.open')));
    expect(screen.getByRole('menuitem', { name: 'Open' })).toBeDefined();
    await act(async () => { rerender(ui(menu('file.save'))); });
    expect(screen.getByRole('menuitem', { name: 'Save' })).toBeDefined();
  });

  it('says a menu with no rows is empty, and how to give it some', async () => {
    const empty: PrefGroup = { name: 'File', description: '', as: 'menu', children: {} };
    await renderSettled(<ActionsProvider><PreviewPane schema={empty} onDefaults={vi.fn()} /></ActionsProvider>);
    expect(screen.getByText(/This menu is empty/).textContent).toMatch(/Actions/);
  });

  it('says why a menu whose rows name no registered action draws nothing', async () => {
    await renderSettled(<ActionsProvider><PreviewPane schema={menu('file.nowhere')} onDefaults={vi.fn()} /></ActionsProvider>);
    expect(screen.getByText(/None of this menu’s rows/)).toBeDefined();
  });

  it('says nothing once the menu has a row to draw', async () => {
    await renderSettled(<ActionsProvider><Command /><PreviewPane schema={menu('file.open')} onDefaults={vi.fn()} /></ActionsProvider>);
    expect(screen.queryByText(/This menu is empty|None of this menu’s rows/)).toBeNull();
  });
});
