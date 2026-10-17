import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SPECIMEN_SECTIONS, Specimen } from './Specimen';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';

describe('<Specimen>', () => {
  it('renders every section as a named region', () => {
    renderWithIcons(<Specimen />);
    expect(SPECIMEN_SECTIONS.length).toBeGreaterThan(0);
    for (const title of SPECIMEN_SECTIONS) {
      expect(screen.getByRole('region', { name: title })).toBeInTheDocument();
    }
  });
});
