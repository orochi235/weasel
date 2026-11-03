import { describe, expect, it } from 'vitest';
import { browserProcesses, browserShards } from './browser-shards.mjs';

describe('browserProcesses', () => {
  it('splits on the node sizes it was measured on, and keeps one process below them', () => {
    expect([4, 8, 10, 14, 18].map(browserProcesses)).toEqual([1, 1, 3, 3, 3]);
  });
});

describe('browserShards', () => {
  it('gives each process its own slice of the files', () => {
    expect(browserShards(['run', '--project=browser'], 3)).toEqual([
      ['run', '--project=browser', '--passWithNoTests', '--shard=1/3'],
      ['run', '--project=browser', '--passWithNoTests', '--shard=2/3'],
      ['run', '--project=browser', '--passWithNoTests', '--shard=3/3'],
    ]);
  });

  it('keeps one process when asked for one', () => {
    expect(browserShards(['run', '--project=browser'], 1)).toEqual([['run', '--project=browser']]);
  });

  it('keeps one process when the caller already runs a slice, which a second split cannot divide', () => {
    expect(browserShards(['run', '--project=browser', '--shard=2/4'], 3)).toEqual([['run', '--project=browser', '--shard=2/4']]);
  });

  it('does not repeat --passWithNoTests', () => {
    expect(browserShards(['run', '--passWithNoTests'], 2)[0]).toEqual(['run', '--passWithNoTests', '--shard=1/2']);
  });
});
