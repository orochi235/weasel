import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { asset, hasRow, Live, tool } from './AssetEditor.fixture';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('AssetEditor folds', () => {
  it('keeps an asset\'s folded rows while another is shown, with no draft key to keep them under', () => {
    render(<Live />);
    fireEvent.click(tool('Collapse all'));
    expect(hasRow('grid')).toBe(false);
    fireEvent.click(asset('Code'));
    expect(hasRow('grid')).toBe(true);
    fireEvent.click(asset('Settings'));
    expect(hasRow('view')).toBe(true);
    expect(hasRow('grid')).toBe(false);
    expect(localStorage.length).toBe(0);
  });
});
