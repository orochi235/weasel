import { describe, expect, it } from 'vitest';
import { groupOf, readMarker, setMarker } from './entry-marker';
import { isGrabBag, lintChangeset } from './lint';
import { withPick } from './pick';

describe('readMarker', () => {
  it('reads tags, rank and pick, and cuts the marker from the body', () => {
    const r = readMarker('A new thing.\n\n<!-- entry: rank=10 api new pick -->\n');
    expect(r).toEqual({ ok: true, meta: { tags: ['api', 'new'], rank: 10, pick: true }, body: 'A new thing.' });
  });

  it('reads a negative rank and defaults an unset one to 0', () => {
    expect(readMarker('x <!-- entry: rank=-3 fix -->')).toMatchObject({ meta: { rank: -3 } });
    expect(readMarker('x <!-- entry: fix -->')).toMatchObject({ meta: { rank: 0, pick: false } });
  });

  it.each([
    ['No marker.', /no <!-- entry/],
    ['x <!-- entry: rank=2 -->', /names no tag/],
    ['x <!-- entry: fix shiny -->', /unknown word "shiny"/],
    ['x <!-- entry: fix constructor -->', /unknown word "constructor"/],
    ['x <!-- entry: internal fix -->', /`internal` cannot/],
    ['x <!-- entry: fix --> <!-- entry: new -->', /more than one/],
  ])('refuses %j', (body, error) => {
    const r = readMarker(body);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(error);
  });
});

describe('setMarker', () => {
  it('replaces a marker in place and round-trips through readMarker', () => {
    const body = setMarker('Prose.\n\n<!-- entry: fix -->', { tags: ['fix', 'visual'], rank: 0, pick: true });
    expect(body).toBe('Prose.\n\n<!-- entry: visual fix pick -->\n');
    expect(readMarker(body)).toMatchObject({ ok: true, meta: { tags: ['visual', 'fix'], pick: true } });
  });
});

describe('groupOf', () => {
  it.each([
    [['fix', 'breaking'], 'breaking'],
    [['api', 'deprecates'], 'new'],
    [['behavior'], 'changed'],
    [['perf', 'fix'], 'perf'],
    [['fix', 'visual'], 'fix'],
    [['visual'], 'fix'],
    [['internal'], 'internal'],
  ] as const)('%j → %s', (tags, group) => {
    expect(groupOf(tags)).toBe(group);
  });
});

const changeset = (body: string) => `---\n"@weasel-js/core": patch\n---\n\n${body}\n`;

const errorsOf = (text: string) => lintChangeset(text).errors;

describe('lintChangeset', () => {
  it('passes a short tagged fix', () => {
    expect(lintChangeset(changeset('The pencil draws over a shape.\n\n<!-- entry: fix -->'))).toEqual({ errors: [], warnings: [] });
  });

  it('warns of a long title without refusing it', () => {
    expect(lintChangeset(changeset(`${'word '.repeat(40)}end.\n\n<!-- entry: fix -->`))).toEqual({
      errors: [],
      warnings: ['the title runs 204 characters; keep it under 140'],
    });
  });

  it('refuses a grab bag, a bodiless breaking change and a long fix', () => {
    expect(errorsOf(changeset('Fixes to A and B.\n\n<!-- entry: fix -->'))).toEqual([
      'the title lists several changes; write one changeset per change',
    ]);
    expect(errorsOf(changeset('Removes `foo`.\n\n<!-- entry: breaking -->'))[0]).toMatch(/needs a body/);
    expect(errorsOf(changeset(`Short.\n\n${'x '.repeat(400)}\n\n<!-- entry: fix -->`))[0]).toMatch(/a fix runs/);
  });

  it('refuses a level below what its tags make the change', () => {
    const at = (level: string, tags: string) =>
      errorsOf(`---\n"@weasel-js/core": ${level}\n---\n\nA thing.\n\nWhat to change.\n\n<!-- entry: ${tags} -->\n`);
    expect(at('patch', 'api')).toEqual([
      'its tags (api) make it a `minor` change, but it says `patch`; write the level semver gives it',
    ]);
    expect(at('minor', 'breaking api')[0]).toMatch(/a `major` change, but it says `minor`/);
    expect(at('minor', 'new')).toEqual([]);
    expect(at('major', 'breaking')).toEqual([]);
    expect(at('minor', 'fix')).toEqual([]);
  });

  it('reads the highest level a changeset releases any package at', () => {
    expect(errorsOf('---\n"a": patch\n"b": minor\n---\n\nA thing.\n\n<!-- entry: api -->\n')).toEqual([]);
  });

  it('refuses a marker that opens the body', () => {
    expect(errorsOf(changeset('<!-- entry: fix -->\n\nProse.'))).toContain(
      'the entry marker opens the body; move it to the end',
    );
  });
});

describe('isGrabBag', () => {
  it.each([
    ['Fixes to the hand tool and the pencil', true],
    ['Fix A, B, and C', true],
    ['A fix to loading a saved scene', true],
    ['Fix the pencil over a shape', false],
    ['Fixed-size handles, at last', false],
  ])('%j → %s', (title, expected) => {
    expect(isGrabBag(title)).toBe(expected);
  });
});

describe('withPick', () => {
  it('rewrites only the marker, keeping the frontmatter as written', () => {
    const text = changeset('Prose.\n\n<!-- entry: rank=4 new -->');
    const out = withPick(text, 'Prose.\n\n<!-- entry: rank=4 new -->', { tags: ['new'], rank: 4, pick: false }, true);
    expect(out).toBe('---\n"@weasel-js/core": patch\n---\n\nProse.\n\n<!-- entry: rank=4 new pick -->\n');
  });
});
