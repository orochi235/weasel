import { describe, expect, it } from 'vitest';
import { KEY_SPELLINGS, pickSpelling, spellingsOf } from './legendFit';

const fit = (label: string, scale: number) => ({ label, lines: label.split('\n').length, scale });

describe('pickSpelling', () => {
  it('takes the first spelling that fits at full size', () => {
    const forms = [fit('Backspace', 0.7), fit('Bksp', 1), fit('Back\nspace', 1)];
    expect(pickSpelling(forms, { wrap: true, minScale: 0.6 }).label).toBe('Bksp');
  });

  it('prefers a two-line form over shrinking when wrap is on', () => {
    const forms = [fit('PgUp', 0.8), fit('Pg\nUp', 0.9)];
    expect(pickSpelling(forms, { wrap: true, minScale: 0.6 }).label).toBe('Pg\nUp');
  });

  it('never picks a two-line form when wrap is off', () => {
    const forms = [fit('PgUp', 0.5), fit('Pg\nUp', 1)];
    expect(pickSpelling(forms, { wrap: false, minScale: 0.6 }).label).toBe('PgUp');
    const shorter = [fit('Backspace', 0.5), fit('Bksp', 0.8), fit('Back\nspace', 1)];
    expect(pickSpelling(shorter, { wrap: false, minScale: 0.6 }).label).toBe('Bksp');
  });

  it('shrinks to the spelling that fits at the largest type when none fits whole', () => {
    const forms = [fit('Backspace', 0.5), fit('Bksp', 0.8)];
    expect(pickSpelling(forms, { wrap: false, minScale: 0.6 })).toEqual(fit('Bksp', 0.8));
  });

  it('passes over a two-line form that would still print below the floor', () => {
    const forms = [fit('PgUp', 0.7), fit('Pg\nUp', 0.5)];
    expect(pickSpelling(forms, { wrap: true, minScale: 0.6 }).label).toBe('PgUp');
  });
});

describe('spellingsOf', () => {
  it('lists the legend first, then its alternates from the table', () => {
    expect(spellingsOf('Insert', KEY_SPELLINGS)).toEqual(['Insert', 'Ins']);
    expect(spellingsOf('Q', KEY_SPELLINGS)).toEqual(['Q']);
  });
});
