import { describe, it, expect } from 'vitest';
import { eligibleForMode } from './modeDefinition';
import type { ModeDefinition } from './modeDefinition';

const PATH_EDIT: ModeDefinition = {
  id: 'path-edit',
  kind: 'soft',
  allows: ['edits-anchors'],
  scoping: true,
  workspace: { tint: '#3b82f6', gradient: 'bottom-up', intensity: 0.12 },
};

describe('eligibleForMode', () => {
  it('allows tools with any of the mode\'s declared tags', () => {
    expect(eligibleForMode(PATH_EDIT, ['edits-anchors'])).toBe(true);
  });

  it('always allows navigation (implicit tag)', () => {
    expect(eligibleForMode(PATH_EDIT, ['navigation'])).toBe(true);
  });

  it('rejects tools whose tags are neither declared nor implicit', () => {
    expect(eligibleForMode(PATH_EDIT, ['creates-paths'])).toBe(false);
  });

  it('a tool with multiple tags is eligible if any tag is allowed', () => {
    expect(eligibleForMode(PATH_EDIT, ['edits-anchors', 'creates-paths'])).toBe(true);
  });

  it('a tool with no tags is not eligible', () => {
    expect(eligibleForMode(PATH_EDIT, [])).toBe(false);
  });
});
