import { describe, expect, it, vi } from 'vitest';
import type { ApiTable } from '../../story/api';
import type { IndexBundle } from '../../story/indexBundle';
import { indexEnvOf } from './indexEnv';

const API: ApiTable = { props: [], inherited: [], ref: null };

const bundleOf = (over: Partial<IndexBundle> = {}): IndexBundle => ({
  title: 'ui/Chip',
  library: 'ui',
  galleries: [],
  labs: [],
  stories: [],
  descriptions: {},
  render: null,
  ...over,
});

const inputs = { graph: null, globals: {}, decorators: [], open: vi.fn() };

describe('indexEnvOf', () => {
  it("carries the bundle's API, null included", () => {
    expect(indexEnvOf(bundleOf({ api: API }), inputs).api).toEqual(API);
    expect(indexEnvOf(bundleOf({ api: null }), inputs).api).toBeNull();
  });

  it('gives a gallery no API', () => {
    expect(indexEnvOf(bundleOf({ api: API, tags: ['gallery'] }), inputs).api).toBeUndefined();
  });
});
