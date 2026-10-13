import { describe, expect, it } from 'vitest';
import { formatNumber, ICON_PATHS, MINUS_SIGN } from './weasel-ui';

describe('weasel-ui passthrough', () => {
  it('re-exports formatNumber with MINUS_SIGN convention', () => {
    expect(formatNumber(-3.14)).toBe(`${MINUS_SIGN}3.14`);
  });

  it('re-exports the icon set, so a lab need not depend on weasel-ui itself', () => {
    expect(ICON_PATHS.layoutRows).toContain('<rect');
    expect(ICON_PATHS.layoutColumns).toContain('<rect');
    expect(ICON_PATHS.layoutGrid).toContain('<rect');
  });
});
