import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FitLabel, labelForms } from './FitLabel';

describe('labelForms', () => {
  it('puts the name ahead of its shorter forms', () => {
    expect(labelForms('Tracking', ['Track', 'VA'])).toEqual(['Tracking', 'Track', 'VA']);
  });

  it('is the name alone without shorter forms', () => {
    expect(labelForms('Size')).toEqual(['Size']);
  });

  it('drops a missing name rather than offering it as a form', () => {
    expect(labelForms(undefined, ['B'])).toEqual(['B']);
  });
});

describe('FitLabel', () => {
  it('shows its first form outside any scope', () => {
    const { container } = render(<FitLabel forms={['Tracking', 'VA']} />);
    expect(container.textContent).toBe('Tracking');
  });
});
