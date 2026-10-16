/**
 * The README's package table: descriptions are kept from the table as it
 * stands, and the marks beside each name are drawn from `packageTraits`.
 */
const START = '<!-- packages:start -->';
const END = '<!-- packages:end -->';

const MARKS = [
  ['react', (t) => t.react === 'needs', 'Needs React'],
  ['react-optional', (t) => t.react === 'optional', 'React only under the /react subpath'],
  ['dom', (t) => t.dom, 'Needs a browser: document, window or navigator'],
  ['webgl2', (t) => t.webgl2, 'Draws with WebGL2'],
  ['webaudio', (t) => t.webaudio, 'Plays through Web Audio'],
  ['standalone', (t) => t.standalone, 'Depends on no other weasel package'],
];

const img = (name, title) =>
  `<img src="docs/badges/${name}.svg" width="20" height="20" alt="${title}" title="${title}">`;

const LEGEND = [
  img('react', 'Needs React') + ' needs React',
  img('react-optional', 'React only under the /react subpath') + ' React only under `/react`',
  img('dom', 'Needs a browser') + ' needs a browser; the rest run in Node or a worker',
  img('webgl2', 'Draws with WebGL2') + ' WebGL2',
  img('webaudio', 'Plays through Web Audio') + ' Web Audio',
  img('standalone', 'Depends on no other weasel package') + ' no other weasel package',
].join(' · ');

/** Descriptions by package name, read from the table between the markers. */
function descriptions(block) {
  const out = new Map();
  for (const line of block.split('\n')) {
    const m = line.match(/^\| `([^`]+)` \|(?: [^|]* \|)? (.*) \|$/);
    if (m) out.set(m[1], m[2]);
  }
  return out;
}

/** The README with its package table redrawn. Throws when a package has no description. */
export function renderReadme(readme, traits) {
  const a = readme.indexOf(START);
  const b = readme.indexOf(END);
  if (a < 0 || b < a) throw new Error(`README.md has no ${START} … ${END} block`);
  const old = descriptions(readme.slice(a, b));
  const missing = [...traits.keys()].filter((n) => !old.has(n));
  if (missing.length) {
    throw new Error(
      `README.md's package table has no row for ${missing.join(', ')}. ` +
        'Add "| `name` | what it is |" inside the block, then rerun with --write.',
    );
  }
  const order = [...old.keys()].filter((n) => traits.has(n));
  const rows = order.map((n) => {
    const t = traits.get(n);
    const marks = MARKS.filter(([, has]) => has(t)).map(([name, , title]) => img(name, title)).join('');
    return `| \`${n}\` | ${marks} | ${old.get(n)} |`;
  });
  const table = [START, '', LEGEND, '', '| Package | | What it is |', '|---|---|---|', ...rows, '', END].join('\n');
  return readme.slice(0, a) + table + readme.slice(b + END.length);
}
