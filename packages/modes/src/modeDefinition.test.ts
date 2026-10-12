import { describe, it, expect } from 'vitest';
import { eligibleForMode, modeLabel } from './modeDefinition';
import type { ModeDefinition } from './modeDefinition';

const PATH_EDIT: ModeDefinition = {
  id: 'path-edit',
  kind: 'soft',
  allows: ['edits-anchors'],
  scoping: true,
  workspace: { tint: '#3b82f6', gradient: 'bottom-up', intensity: 0.12 },
};

describe('eligibleForMode', () => {
  it('allows a tool carrying one of the mode\'s declared tags', () => {
    expect(eligibleForMode(PATH_EDIT, ['edits-anchors'])).toBe(true);
  });

  it('always allows navigation (implicit tag)', () => {
    expect(eligibleForMode(PATH_EDIT, ['navigation'])).toBe(true);
  });

  it('rejects tools whose tags are neither declared nor implicit', () => {
    expect(eligibleForMode(PATH_EDIT, ['creates-paths'])).toBe(false);
  });

  it('a tool with several tags is eligible only when every one is allowed', () => {
    expect(eligibleForMode(PATH_EDIT, ['edits-anchors', 'navigation'])).toBe(true);
    expect(eligibleForMode(PATH_EDIT, ['edits-anchors', 'creates-paths'])).toBe(false);
    expect(eligibleForMode(PATH_EDIT, ['navigation', 'creates-paths'])).toBe(false);
  });

  it('a tool with no tags asks for nothing, so every mode allows it', () => {
    expect(eligibleForMode(PATH_EDIT, [])).toBe(true);
  });
});

describe('modeLabel', () => {
  it('reads the display label when the mode has one', () => {
    expect(modeLabel({ ...PATH_EDIT, label: 'Path Edit' })).toBe('Path Edit');
  });

  it('falls back to the id', () => {
    expect(modeLabel(PATH_EDIT)).toBe('path-edit');
  });
});
