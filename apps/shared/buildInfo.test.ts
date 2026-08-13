import { describe, expect, it } from 'vitest';

import { BUILD_DATE, BUILD_VERSION, buildLabel, buildTitle } from './buildInfo';

describe('buildInfo', () => {
  it('reports the kit version it was compiled against', () => {
    expect(BUILD_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    expect(BUILD_VERSION).not.toBe('0.0.0-unknown');
  });

  it('gets a build timestamp from the shared vite defines', () => {
    expect(BUILD_DATE).toBeTypeOf('string');
    expect(Number.isNaN(new Date(BUILD_DATE as string).getTime())).toBe(false);
  });

  it('labels a production build with version and short date', () => {
    expect(buildLabel(true)).toMatch(/^\d+\.\d+\.\d+.* · \w{3} \d{1,2}$/);
  });

  it('says "dev" rather than passing a dev-server start off as a build date', () => {
    expect(buildLabel(false)).toBe(`${BUILD_VERSION} · dev`);
    expect(buildTitle(false)).toContain('dev server started');
    expect(buildTitle(true)).toContain('built');
  });
});
