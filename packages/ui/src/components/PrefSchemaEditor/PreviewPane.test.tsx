import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  it('previews a menu root open', async () => {
    const schema: PrefGroup = {
      name: 'File', description: '', as: 'menu',
      children: { open: { kind: 'action', action: 'file.open', name: '', description: '', default: undefined } },
    };
    await renderSettled(<ActionsProvider><Command /><PreviewPane schema={schema} onDefaults={vi.fn()} /></ActionsProvider>);
    expect(screen.getByRole('menuitem', { name: 'Open' })).toBeDefined();
  });
});
