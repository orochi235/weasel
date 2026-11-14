import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PrefGroup, PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { PreviewPane } from './PreviewPane';

afterEach(cleanup);

const pointer = (of: string): PrefLeaf => ({ kind: 'alias', name: '', description: '', default: undefined, of });

/** A node's own schema, its keys steps of the node path. */
const NODE: PrefGroup = {
  name: 'Node',
  children: {
    data: { name: 'Data', children: { tint: { kind: 'string', name: 'Tint', description: '', default: 'red' } } },
  },
};

/** A properties layout of pointers into {@link NODE}. */
const LAYOUT: PrefSection = { name: 'Look', members: { look: { name: 'Look', members: { tint: pointer('data.tint') } } } };

describe('the preview of a properties layout over another schema', () => {
  it("draws a pointer's row holding the default of the leaf it shows", () => {
    render(<PreviewPane schema={LAYOUT} over={NODE} onDefaults={() => {}} />);
    expect(screen.getByRole('textbox', { name: 'Tint' })).toHaveValue('red');
  });

  it('keeps an edit to that row in the preview, and makes no default of it', () => {
    const onDefaults = vi.fn();
    render(<PreviewPane schema={LAYOUT} over={NODE} onDefaults={onDefaults} />);
    const field = screen.getByRole('textbox', { name: 'Tint' });
    fireEvent.change(field, { target: { value: 'blue' } });
    fireEvent.blur(field);
    expect(screen.getByRole('textbox', { name: 'Tint' })).toHaveValue('blue');
    expect(onDefaults).not.toHaveBeenCalled();
  });
});
