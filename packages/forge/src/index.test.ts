import { describe, expect, it } from 'vitest';
import { f } from './index';

describe('@weasel-js/forge', () => {
  it('re-exports the config builder', () => {
    expect(f.schema({ n: f.number(1) }).defaults()).toEqual({ n: 1 });
  });
});
