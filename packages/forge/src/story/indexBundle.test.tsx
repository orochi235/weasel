import { describe, expect, it } from 'vitest';
import { API_EXPORT, type ApiTable } from './api';
import { meta, story } from './define';
import { type BundleEntry, loadIndexBundle } from './indexBundle';
import { indexId } from './indexPages';

const API: ApiTable = { props: [{ name: 'label', type: 'string', required: true }], inherited: [], ref: null };

const entry = (file: string, exportName: string): BundleEntry => ({ id: `ui-chip--${exportName.toLowerCase()}`, title: 'ui/Chip', file, exportName });

const moduleOf = (exportName: string, api?: ApiTable | null): Record<string, unknown> => ({
  default: meta({ title: 'ui/Chip' }),
  [exportName]: story({ render: () => null }),
  ...(api === undefined ? {} : { [API_EXPORT]: api }),
});

const load = (mods: Record<string, Record<string, unknown>>) =>
  loadIndexBundle(indexId('ui/Chip'), {
    index: Object.keys(mods).map((file, i) => entry(file, i === 0 ? 'Basic' : 'More')),
    importOf: async (file) => mods[file] ?? {},
  });

describe('loadIndexBundle', () => {
  it('takes the API from the primary file', async () => {
    const bundle = await load({ '/chip.stories.tsx': moduleOf('Basic', API), '/more.stories.tsx': moduleOf('More') });
    expect(bundle.api).toEqual(API);
  });

  it('keeps null where forge read the file and found no component', async () => {
    expect((await load({ '/chip.stories.tsx': moduleOf('Basic', null) })).api).toBeNull();
  });

  it('has no API where the module carries none', async () => {
    expect((await load({ '/chip.stories.tsx': moduleOf('Basic') })).api).toBeUndefined();
  });
});
