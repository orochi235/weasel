import { describe, expect, it } from 'vitest';
import { EMPHASES, EMPHASIS_FG, GRADES, GRADE_TOKENS, STANCES } from './appearance';

describe('appearance value lists', () => {
  it('lists the stances as angles, with no severity among them', () => {
    expect(STANCES).toEqual(['clarify', 'aside', 'advanced', 'debug', 'preview', 'confirm', 'cancel']);
  });

  it('maps every grade to a theme token', () => {
    expect(GRADES).toEqual(['info', 'success', 'warn', 'danger']);
    expect(GRADE_TOKENS).toEqual({
      info: '--wzl-info',
      success: '--wzl-success',
      warn: '--wzl-warning',
      danger: '--wzl-danger',
    });
  });

  it('maps every emphasis to the text color it lends', () => {
    expect(EMPHASES).toEqual(['high', 'low']);
    expect(EMPHASIS_FG).toEqual({ high: 'var(--wzl-accent-fg)', low: 'var(--wzl-fg-muted)' });
  });
});
