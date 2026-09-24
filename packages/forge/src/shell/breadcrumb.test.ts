import { describe, expect, it } from 'vitest';
import { breadcrumb } from './breadcrumb';

describe('breadcrumb', () => {
  it('separates the title segments and the name with >', () => {
    expect(breadcrumb('Primitives/Select', 'At The Top Edge')).toBe('Primitives > Select > At The Top Edge');
  });

  it('leaves out an index segment, but not a lone one', () => {
    expect(breadcrumb('Icons/index', 'Grid')).toBe('Icons > Grid');
    expect(breadcrumb('Icons', 'Index')).toBe('Icons');
    expect(breadcrumb('index', 'Grid')).toBe('index > Grid');
  });
});
