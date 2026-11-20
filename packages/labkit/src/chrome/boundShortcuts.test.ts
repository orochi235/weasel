import { describe, expect, it } from 'vitest';
import { icon } from '../icons.gen';
import { withBoundShortcuts } from './LabChrome';
import type { LabContribution } from './labTypes';

const header: LabContribution = {
  id: 'publish',
  region: 'header',
  item: {
    icon: icon('ui:add'),
    label: 'Publish',
    keys: { kind: 'key', key: 'p' },
    shortcut: { key: 'p' },
    onActivate: () => {},
  },
};

describe('withBoundShortcuts', () => {
  it('keeps the declared shortcut of an item whose command is not registered', () => {
    const [out] = withBoundShortcuts([header], []);
    expect(out?.item).toMatchObject({ shortcut: { key: 'p' } });
  });
});
