import { describe, expect, it } from 'vitest';

import { weaselDefines } from '../../../scripts/vite-build-info';
import pkg from '../package.json';
import { VERSION } from './version';

describe('VERSION', () => {
  it('matches the version in package.json', () => {
    expect(VERSION).toBe(pkg.version);
  });

  it('is not the missing-define fallback', () => {
    expect(VERSION).not.toBe('0.0.0-unknown');
  });
});

/**
 * The wiring check. `VERSION` under test reads the globals vitest.setup.ts
 * installs, so it can't prove a build config is correct — but every config
 * that bundles kit source injects exactly what this helper returns, so
 * asserting the helper covers the shared half of the path.
 */
describe('weaselDefines', () => {
  const defines = weaselDefines(process.cwd());

  it('injects core\'s package.json version', () => {
    expect(defines.__WEASEL_CORE_VERSION__).toBe(JSON.stringify(pkg.version));
  });

  it('injects a parseable ISO build timestamp', () => {
    const date = new Date(JSON.parse(defines.__WEASEL_BUILD_DATE__ as string) as string);
    expect(Number.isNaN(date.getTime())).toBe(false);
  });
});
