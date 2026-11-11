/** Counterexamples the run grammar's property tests shrank to, kept as plain cases. */
import { describe, expect, it } from 'vitest';
import { markdownToRuns, runsToMarkdown, type RunGrammar } from './runs';

describe('run grammar, shrunk counterexamples', () => {
  it('spells a change whose markers would fuse into another marker some other way', () => {
    // `__` then `_` written in a row is `___`, which reads as underline.
    const g: RunGrammar = { markers: [
      { delimiter: '*', repeat: 1, flags: ['strikethrough', 'overline'] },
      { delimiter: '_', repeat: 2, flags: ['overline'] },
      { delimiter: '_', repeat: 3, flags: ['underline'] },
      { delimiter: '_', repeat: 1, flags: ['italic'] },
    ] };
    const md = runsToMarkdown([{ text: '*', italic: true, overline: true }], g);
    expect(markdownToRuns(md, g)).toEqual([{ text: '*', italic: true, overline: true }]);
  });

  it('drops a flag no spelling can say there, rather than styling the text after it', () => {
    // Closing strikethrough and overline at once is `___`, italic and overline, and nothing else says it.
    const g: RunGrammar = { markers: [
      { delimiter: '_', repeat: 2, flags: ['strikethrough'] },
      { delimiter: '_', repeat: 3, flags: ['italic', 'overline'] },
      { delimiter: '_', repeat: 1, flags: ['overline'] },
    ] };
    const md = runsToMarkdown([{ text: '*', strikethrough: true }, { text: '*', strikethrough: true, overline: true }, { text: '\n' }], g);
    expect(markdownToRuns(md, g)).toEqual([{ text: '**', strikethrough: true }, { text: '\n' }]);
  });
});
