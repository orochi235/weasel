import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { UiInputDemo } from '../UiInputDemo';

afterEach(cleanup);

const highlighted = () => screen.getAllByRole('option').find((o) => o.getAttribute('aria-selected') === 'true')?.textContent;

describe('UiInputDemo', () => {
  it('moves the highlight past headings by arrow, and to a row by typeahead', () => {
    render(<UiInputDemo />);
    const list = screen.getByRole('listbox');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(highlighted()).toBe('apple');
    fireEvent.keyDown(list, { key: 'End' });
    expect(highlighted()).toBe('chard');
    // Wraps past the Fruit heading rather than landing on it.
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(highlighted()).toBe('apple');
    fireEvent.keyDown(list, { key: 'c', timeStamp: 1000 });
    fireEvent.keyDown(list, { key: 'a', timeStamp: 1100 });
    expect(highlighted()).toBe('carrot');
  });

  it('hands a character outside the BMP to typeahead as one typed character', () => {
    render(<UiInputDemo />);
    fireEvent.keyDown(screen.getByRole('listbox'), { key: '🍎', timeStamp: 1000 });
    expect(screen.getByText("typeaheadStep('🍎') → null")).toBeTruthy();
  });
});
