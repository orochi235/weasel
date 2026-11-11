/**
 * Split an entry into its opening sentence and the rest. Changeset prose is
 * hard-wrapped, so the opening paragraph ends at the first blank line, not the
 * first newline; its first sentence is the summary, and the paragraph's
 * remainder leads the rest. The summary is unwrapped so it renders inline.
 */
export function splitSummary(body: string): [summary: string, rest: string] {
  const brk = body.search(/\n[ \t]*\n/);
  const para = brk === -1 ? body : body.slice(0, brk);
  const after = brk === -1 ? '' : body.slice(brk).trim();
  // A fence, list or table opening the entry is not a summary paragraph.
  if (/^\s*(```|[-*+] |\d+\. |#|\|)/.test(para)) return ['', body.trim()];
  const [first, more] = splitSentence(unwrap(para));
  return [first, [more, after].filter(Boolean).join('\n\n')];
}

/** Cut at the first sentence end outside a code span: `.`, `!` or `?`, then a
 *  space and something that is not a lowercase letter, so `e.g. this` holds. */
function splitSentence(text: string): [first: string, more: string] {
  let inCode = false;
  for (let i = 0; i < text.length - 2; i++) {
    const c = text[i];
    if (c === '`') inCode = !inCode;
    else if (!inCode && '.!?'.includes(c) && text[i + 1] === ' ' && !/[a-z]/.test(text[i + 2])) {
      return [text.slice(0, i + 1), text.slice(i + 2)];
    }
  }
  return [text, ''];
}

function unwrap(text: string): string {
  return text.trim().replace(/\s*\n\s*/g, ' ');
}
