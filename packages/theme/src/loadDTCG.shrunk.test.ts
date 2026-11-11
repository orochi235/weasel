import { describe, expect, it } from 'vitest';
import { loadDTCG, type DtcgDocument } from './loadDTCG';

const withAxes = (ext: unknown): DtcgDocument => ({ name: 'fuzz', extends: null, $extensions: { 'com.weasel.axes': ext } });

describe('loadDTCG, shrunk counterexamples', () => {
  it('refuses an axes extension whose varies entry is not a list of axis names', () => {
    expect(() => loadDTCG(withAxes({ axes: {}, varies: { fg: 1.5 } }))).toThrow('varies "fg" needs a list of axis names');
  });

  it('refuses an axes extension whose override layer is not an object', () => {
    expect(() => loadDTCG(withAxes({ axes: {}, overrides: { '': null } }))).toThrow('override "" needs an object');
  });

  it('refuses an axes extension whose axis has no values', () => {
    expect(() => loadDTCG({ ...withAxes({ axes: { mode: {} } }), modes: { dark: {} } })).toThrow('axis "mode" needs a string "default"');
  });
});
