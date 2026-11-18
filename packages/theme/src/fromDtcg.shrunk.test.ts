import { describe, expect, it } from 'vitest';
import { fromDtcg, type DtcgDocument } from './fromDtcg';

const withAxes = (ext: unknown): DtcgDocument => ({ name: 'fuzz', extends: null, $extensions: { 'com.weasel.axes': ext } });

describe('fromDtcg, shrunk counterexamples', () => {
  it('refuses an axes extension whose varies entry is not a list of axis names', () => {
    expect(() => fromDtcg(withAxes({ axes: {}, varies: { fg: 1.5 } }))).toThrow('varies "fg" needs a list of axis names');
  });

  it('refuses an axes extension whose override layer is not an object', () => {
    expect(() => fromDtcg(withAxes({ axes: {}, overrides: { '': null } }))).toThrow('override "" needs an object');
  });

  it('refuses an axes extension whose axis has no values', () => {
    expect(() => fromDtcg({ ...withAxes({ axes: { mode: {} } }), modes: { dark: {} } })).toThrow('axis "mode" needs a string "default"');
  });
});
