import { describe, expect, it } from 'vitest';
import { mergeSampling } from './samplingMerge';

describe('mergeSampling', () => {
  it('takes the keys a change sets and keeps the rest, an undefined one included', () => {
    const was = { min: 'linear', mag: 'linear', wrapS: 'clamp', wrapT: 'clamp', mipmap: true } as const;
    expect(mergeSampling(was, { mag: 'nearest', mipmap: undefined, min: undefined })).toEqual({ ...was, mag: 'nearest' });
    expect(mergeSampling(was, { mipmap: false })).toEqual({ ...was, mipmap: false });
  });
});
