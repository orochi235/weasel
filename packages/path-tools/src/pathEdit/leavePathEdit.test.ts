import { describe, expect, it } from 'vitest';
import { ActionDisabledReason } from '@weasel-js/routing';
import { leavePathEditAction } from './leavePathEdit';

describe('leavePathEditAction', () => {
  const enabled = (deps: object) => leavePathEditAction.enabled!(deps as never);

  it('is enabled while a path is open', () => {
    expect(enabled({ editAnchors: { editingId: 'p' } })).toBe(true);
  });

  it('is enabled where it would return to the mode default tool', () => {
    expect(enabled({
      editAnchors: { editingId: null },
      modeDefaultTool: () => 'anchors',
      activeTool: { active: 'sand', setActive: () => {} },
    })).toBe(true);
  });

  it('stands aside, leaving Escape to the next binding, with no path open and no tool to return to', () => {
    expect(enabled({ editAnchors: { editingId: null } })).toBe(ActionDisabledReason.NotApplicable);
    expect(enabled({})).toBe(ActionDisabledReason.NotApplicable);
  });
});
