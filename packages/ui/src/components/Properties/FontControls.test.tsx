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

  it('take the id a label outside them points at', () => {
    render(
      <>
        <label htmlFor="ff">Font</label>
        <PropertyControl kind="font-family" id="ff" value="Inter" onChange={() => {}} />
        <label htmlFor="fw">Heft</label>
        <PropertyControl kind="font-weight" id="fw" value={400} onChange={() => {}} />
      </>,
    );
    // Testing Library will not resolve a label to a button, which a browser does.
    for (const id of ['ff', 'fw']) expect(document.getElementById(id)).toHaveAttribute('aria-haspopup');
  });
});
