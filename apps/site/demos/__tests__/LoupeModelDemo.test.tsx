import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, within } from '@testing-library/react';
import { LoupeModelDemo } from '../LoupeModelDemo';

const factor = (container: HTMLElement): string =>
  within(container).getByText('factor', { selector: 'th' }).nextElementSibling!.textContent!.trim();

describe('LoupeModelDemo', () => {
  it('zooms on the wheel under StrictMode, whose remount disposes the first model', () => {
    const { container } = render(<StrictMode><LoupeModelDemo /></StrictMode>);
    expect(factor(container)).toBe('8.00×');
    fireEvent.wheel(container.querySelector('svg')!, { deltaY: -100 });
    expect(factor(container)).toBe('10.00×');
  });
});
