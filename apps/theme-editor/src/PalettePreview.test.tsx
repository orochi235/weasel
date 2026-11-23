import './labTestSetup';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { DEFAULT_CONSTRAINTS, type Palette } from '@weasel-js/theme/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('<PalettePreview> copy as tokens', () => {
  afterEach(cleanup);

  it('copies a whole token document, valid JSON whatever the swatch names hold', async () => {
    const writeText = vi.fn((_: string) => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const swatches = [
      { name: 'my "brand"', hex: '#112233' },
      { name: 'back\\slash', hex: '#445566' },
    ];
    renderWithIcons(<PalettePreview palette={{ ...palette, swatches } as unknown as Palette} constraints={DEFAULT_CONSTRAINTS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy as tokens' }));
    await act(async () => {});
    expect(JSON.parse(writeText.mock.calls[0]![0])).toEqual({
      'swatch-my "brand"': { $value: '#112233' },
      'swatch-back\\slash': { $value: '#445566' },
    });
  });
});
