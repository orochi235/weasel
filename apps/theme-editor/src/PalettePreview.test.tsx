import './labTestSetup';
import { cleanup, screen } from '@testing-library/react';
import { DEFAULT_CONSTRAINTS, type Palette } from '@weasel-js/theme/engine';
import { afterEach, describe, expect, it } from 'vitest';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { PalettePreview } from './PalettePreview';
import { SURFACES } from './presets';

const stats = {
  meanChroma: 0.15,
  chromaSpread: 0.02,
  lightnessSpread: 0.2,
  minHueGap: 30,
  hueFloorShare: 0.8,
  minContrast: 3.5,
  minDistance: 0.25,
  minSurfaceDistance: 0.3,
};
const palette = { swatches: [], stats } as unknown as Palette;

/** A stat's verdict is its value's class, hashed by CSS modules around the key. */
const verdictOf = (value: string) => screen.getByText(value).className;

describe('<PalettePreview> stats', () => {
  afterEach(cleanup);

  it('judges each stat against the gate the generator was given', () => {
    const c = { ...DEFAULT_CONSTRAINTS, minContrast: 4, minDistance: 0.3, minSurfaceDistance: 0.2 };
    renderWithIcons(<PalettePreview palette={palette} constraints={c} />);
    expect(verdictOf('3.50')).toMatch(/_statBad_/);
    expect(verdictOf('0.250')).toMatch(/_statBad_/);
    expect(verdictOf('0.300')).toMatch(/_statOk_/);
  });

  it('gives no verdict on a stat whose gate is off', () => {
    const c = { ...DEFAULT_CONSTRAINTS, minContrast: 0, minDistance: 0, minSurfaceDistance: 0 };
    renderWithIcons(<PalettePreview palette={{ ...palette, stats: { ...stats, minContrast: 1.1 } } as Palette} constraints={c} />);
    expect(verdictOf('1.10')).toMatch(/_statValue_/);
    expect(verdictOf('0.250')).toMatch(/_statValue_/);
  });

  it('marks the pane drawn on the surface the gate measured against', () => {
    renderWithIcons(<PalettePreview palette={palette} constraints={{ ...DEFAULT_CONSTRAINTS, surface: SURFACES.light }} />);
    expect(screen.getByText('contrast gated here').closest('section')).toHaveTextContent(/^light surface/);
  });
});
