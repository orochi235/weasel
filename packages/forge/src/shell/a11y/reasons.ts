import type { A11yNode } from '../../protocol/messages';

/** axe's message keys for a node it could not decide, said for a person deciding whether to look closer. */
const PLAIN: Record<string, string> = {
  bgOverlap: "axe couldn't tell the background: another element lies on top of this one.",
  pseudoContent: "axe couldn't tell the background: a ::before or ::after box paints over or behind this text.",
  bgGradient: "axe couldn't tell the background: it is a gradient.",
  bgImage: "axe couldn't tell the background: it is an image.",
  imgNode: "axe couldn't tell the background: an image or canvas sits behind this text.",
  elmPartiallyObscured: "axe couldn't tell the background: it covers only part of this text.",
  elmPartiallyObscuring: "axe couldn't tell the background: this text runs across more than one element.",
  outsideViewport: "axe couldn't see this text: it is scrolled out of view.",
  blended: "Couldn't tell the colors: this text or something around it is see-through, filtered, or blended.",
  fgAlpha: "axe couldn't tell the text color: it is partly see-through.",
  complexTextShadows: "axe couldn't tell the contrast: the text has a shadow.",
  equalRatio: 'The text is the same color as its background, so it may be hidden on purpose.',
  shortTextContent: 'Fails contrast, but is a single character that may be a symbol rather than text.',
  nonBmp: 'Holds only symbols or icons, not text.',
};

/** Why a review item is there, in plain words: the known reasons rewritten, anything else in axe's own sentence. */
export function plainReason(reason: A11yNode['reason']): string | null {
  if (!reason) return null;
  return (reason.key ? PLAIN[reason.key] : undefined) ?? reason.message ?? null;
}
