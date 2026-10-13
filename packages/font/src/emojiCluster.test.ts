import { describe, it, expect } from 'vitest';
import { hasEmojiPresentation } from './emojiCluster';

describe('hasEmojiPresentation', () => {
  it.each([
    ['a thumb', '👍'],
    ['a thumb with a skin tone', '👍🏽'],
    ['a flag', '🇨🇦'],
    ['a joined family', '👨‍👩‍👧'],
    ['a text-default symbol asked for as emoji', '❤\uFE0F'],
    ['a keycap', '1\uFE0F\u20E3'],
  ])('holds for %s', (_name, cluster) => {
    expect(hasEmojiPresentation(cluster)).toBe(true);
  });

  it.each([
    ['a letter', 'A'],
    ['a letter with a combining mark', 'e\u0301'],
    ['a digit', '1'],
    ['a text-default symbol on its own', '❤'],
    ['an emoji asked for as text', '⌚\uFE0E'],
    ['an ideograph', '漢'],
  ])('does not hold for %s', (_name, cluster) => {
    expect(hasEmojiPresentation(cluster)).toBe(false);
  });
});
