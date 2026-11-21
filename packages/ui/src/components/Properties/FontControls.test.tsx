import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PropertyControl, PropertyField } from './PropertyField';

describe('font fields', () => {
  it('show a dash and choose nothing while unset, even given a value', () => {
    render(
      <>
        <PropertyField kind="font-family" label="Family" value="Inter" unset onChange={() => {}} />
        <PropertyField kind="font-weight" label="Weight" value={400} unset onChange={() => {}} />
      </>,
    );
    expect(screen.getByRole('button', { name: /Family/ })).toHaveTextContent(/^—$/);
    expect(screen.getByRole('button', { name: /Weight/ })).toHaveTextContent(/^—$/);
  });
});
