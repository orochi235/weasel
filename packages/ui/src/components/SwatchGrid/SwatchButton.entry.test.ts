import { describe, expect, it } from 'vitest';
import * as ui from '../../index';
import { SwatchButton, useSwatchApply } from './SwatchButton';

describe('the swatch button from the package entry', () => {
  it('exports the button and the apply hook it takes', () => {
    expect(ui.SwatchButton).toBe(SwatchButton);
    expect(ui.useSwatchApply).toBe(useSwatchApply);
  });
});
