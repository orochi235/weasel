import { describe, expect, it } from 'vitest';
import { blocksOf, splitTitle } from './markdownBlocks';

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

describe('blocksOf, with a heading shift', () => {
  it('lowers every heading by that many levels, and none past h6', () => {
    const blocks = blocksOf('## Install\n\n##### Deep\n', 2);
    expect(blocks).toEqual([{ kind: 'html', html: '<h4>Install</h4>\n<h6>Deep</h6>' }]);
  });
});

describe('splitTitle', () => {
  it('takes the leading h1 off a document', () => {
    expect(splitTitle('# Working with paths\n\nA path is a list.\n')).toEqual({
      title: 'Working with paths',
      body: '\nA path is a list.\n',
    });
  });

  it('leaves a document with no h1 whole', () => {
    expect(splitTitle('## Install\n')).toEqual({ title: null, body: '## Install\n' });
  });
});
