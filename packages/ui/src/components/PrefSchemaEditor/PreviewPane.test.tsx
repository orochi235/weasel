import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PrefSection } from '@weasel-js/prefs';
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
