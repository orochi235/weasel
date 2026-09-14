import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SPECIMEN_SECTIONS, Specimen } from './Specimen';

describe('<Specimen>', () => {
  it('renders every section as a named region', () => {
    render(<Specimen />);
    expect(SPECIMEN_SECTIONS.length).toBeGreaterThan(0);
    for (const title of SPECIMEN_SECTIONS) {
      expect(screen.getByRole('region', { name: title })).toBeInTheDocument();
    }
  });
});
