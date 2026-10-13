const EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F|\uFE0F\u20E3/u;

/** The first code point that is an emoji by default (U+231A WATCH). */
const FIRST_DEFAULT_EMOJI = 0x231a;

/**
 * Whether a grapheme cluster is drawn as an emoji rather than as text: it
 * holds a code point that is one by default, or one made so by U+FE0F, and no
 * U+FE0E asking for text.
 */
export function hasEmojiPresentation(cluster: string): boolean {
  if (cluster.length === 1 && cluster.charCodeAt(0) < FIRST_DEFAULT_EMOJI) return false;
  return EMOJI.test(cluster) && !cluster.includes('\uFE0E');
}
