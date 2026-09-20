import { describe, expect, it } from 'vitest';
import { findViolations } from '../../../scripts/check-forge-boundary.mjs';

const labkitExports = ['.', './config', './state', './styles.css'];

// Sources are assembled so this file's own text never yields a violation when the checker scans it.
const staticImport = (spec: string) => `import { x } from '${spec}';`;
const mocked = (spec: string) => `vi.mock('${spec}');`;
const typeImport = (spec: string) => `import type { S } from '${spec}';`;
const sideEffect = (spec: string) => `import '${spec}';`;
const dynamicImport = (spec: string) => `const m = import('${spec}');`;

function check(path: string, source: string): string[] {
  return findViolations({ labkitExports, files: [{ path, source }] });
}

describe('forge boundary check', () => {
  it('allows a published labkit subpath', () => {
    expect(check('packages/forge/src/a.ts', staticImport('@weasel-js/labkit/config'))).toEqual([]);
  });

  it('allows the labkit root entry', () => {
    expect(check('packages/forge/src/a.ts', staticImport('@weasel-js/labkit'))).toEqual([]);
  });

  it('flags a labkit subpath missing from its exports, type-only included', () => {
    expect(check('packages/forge/src/a.ts', typeImport('@weasel-js/labkit/state/store'))).toHaveLength(1);
  });

  it('flags a relative import that lands inside labkit', () => {
    expect(check('packages/forge/src/a.ts', staticImport('../../labkit/src/x'))).toHaveLength(1);
  });

  it('allows a relative import that stays inside forge', () => {
    expect(check('packages/forge/src/vite/a.ts', staticImport('../protocol/x'))).toEqual([]);
  });

  it('flags a dynamic import of an unpublished labkit subpath', () => {
    expect(check('packages/forge/src/a.ts', dynamicImport('@weasel-js/labkit/lab/Lab'))).toHaveLength(1);
  });

  it('flags a mocked module path that is not a published labkit entry', () => {
    expect(check('packages/forge/src/a.test.ts', mocked('@weasel-js/labkit/lab/Lab'))).toHaveLength(1);
  });

  it('flags labkit importing forge', () => {
    expect(check('packages/labkit/src/a.ts', staticImport('@weasel-js/forge/vite'))).toHaveLength(1);
  });

  it('flags a relative import from labkit that lands inside forge', () => {
    expect(check('packages/labkit/src/a.ts', sideEffect('../../forge/src/index'))).toHaveLength(1);
  });

  // A story is an input to the workshop rather than part of labkit's library —
  // no tsup entry reaches one and none ships in the tarball — so it is typed by
  // the runner that renders it.
  it('allows a labkit story to import forge', () => {
    expect(check('packages/labkit/src/a.stories.tsx', typeImport('@weasel-js/forge'))).toEqual([]);
    expect(check('packages/labkit/src/a.stories.tsx', staticImport('@weasel-js/forge/play'))).toEqual([]);
  });

  it('still flags a non-story labkit module importing forge', () => {
    expect(check('packages/labkit/src/a.tsx', typeImport('@weasel-js/forge'))).toHaveLength(1);
  });
});
