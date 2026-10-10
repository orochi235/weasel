import { describe, expect, it } from 'vitest';
import { blocksOf, sliceSections } from './vite-get-started';

const README = [
  '# weasel',
  'intro',
  '## Install',
  'npm i',
  '```sh',
  '## not a heading',
  '```',
  '## Features',
  'many',
  '## How it fits together',
  'a scene',
  '### Presets',
  'a table',
  '## License',
  'MIT',
].join('\n');

describe('sliceSections', () => {
  it('returns the named sections in the order asked for, headings included', () => {
    expect(sliceSections(README, ['How it fits together', 'Install'])).toBe(
      [
        '## How it fits together',
        'a scene',
        '### Presets',
        'a table',
        '',
        '## Install',
        'npm i',
        '```sh',
        '## not a heading',
        '```',
      ].join('\n'),
    );
  });

  it('throws on a section the document lacks', () => {
    expect(() => sliceSections(README, ['Install', 'Quick start'])).toThrow(/no "## Quick start" section/);
  });
});

describe('blocksOf', () => {
  it('keeps each fenced block as text with its language, between runs of HTML', () => {
    const blocks = blocksOf(['## Install', '', '```sh', 'npm i', '```', '', 'Then `import` it:', '', '```tsx', '<A />', '```'].join('\n'));
    expect(blocks).toEqual([
      { kind: 'html', html: '<h2>Install</h2>' },
      { kind: 'code', code: 'npm i', language: 'sh' },
      { kind: 'html', html: '<p>Then <code>import</code> it:</p>' },
      { kind: 'code', code: '<A />', language: 'tsx' },
    ]);
  });
});
