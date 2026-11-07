/**
 * Prints what keeps objects alive in a V8 heap snapshot: for each name given, how many live nodes carry it, and the
 * shortest strong path from the GC roots to the oldest few. A name matches a node's constructor or closure name
 * exactly (`onWarn`, `BindingCallableBuiltinPlugin`). Weak edges are not followed, so a node every path to which
 * crosses a WeakRef, a WeakMap key or a weak handle is reported unreachable.
 *
 *   node --max-old-space-size=8192 scripts/heap-retainers.mjs <file.heapsnapshot> <name>... [--paths 3]
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { paths: { type: 'string', default: '3' } } });
const [file, ...names] = positionals;
if (!file || names.length === 0) throw new Error('usage: heap-retainers.mjs <file.heapsnapshot> <name>...');

const snap = JSON.parse(readFileSync(file, 'utf8'));
const meta = snap.snapshot.meta;
const nodeTypes = meta.node_types[0];
const edgeTypes = meta.edge_types[0];
const nf = meta.node_fields.length;
const ef = meta.edge_fields.length;
const [nType, nName, nId, nSize, nEdges] = ['type', 'name', 'id', 'self_size', 'edge_count'].map((f) => meta.node_fields.indexOf(f));
const [eType, eName, eTo] = ['type', 'name_or_index', 'to_node'].map((f) => meta.edge_fields.indexOf(f));
const { nodes, edges, strings } = snap;
const count = nodes.length / nf;

const firstEdge = new Uint32Array(count + 1);
for (let i = 0, e = 0; i < count; i++) {
  firstEdge[i] = e;
  e += nodes[i * nf + nEdges] * ef;
  firstEdge[i + 1] = e;
}

const WEAK = edgeTypes.indexOf('weak');
const SHORTCUT = edgeTypes.indexOf('shortcut');
const parent = new Int32Array(count).fill(-1);
const parentEdge = new Int32Array(count).fill(-1);
parent[0] = 0;
const queue = new Uint32Array(count);
let head = 0;
let tail = 0;
queue[tail++] = 0;
while (head < tail) {
  const from = queue[head++];
  for (let e = firstEdge[from]; e < firstEdge[from + 1]; e += ef) {
    const type = edges[e + eType];
    if (type === WEAK || type === SHORTCUT) continue;
    const to = edges[e + eTo] / nf;
    if (parent[to] !== -1) continue;
    parent[to] = from;
    parentEdge[to] = e;
    queue[tail++] = to;
  }
}

const nodeName = (i) => {
  const type = nodeTypes[nodes[i * nf + nType]];
  const name = strings[nodes[i * nf + nName]];
  return `${type === 'object' || type === 'native' ? '' : `(${type}) `}${name.slice(0, 80)} @${nodes[i * nf + nId]}`;
};
const edgeName = (e) => {
  const type = edgeTypes[edges[e + eType]];
  const name = edges[e + eName];
  return type === 'element' || type === 'hidden' ? `[${name}]` : `${type === 'property' ? '' : `${type}:`}${strings[name]}`;
};

const MATCHED = new Set(['object', 'closure', 'native']);
for (const want of names) {
  const hits = [];
  for (let i = 0; i < count; i++) if (strings[nodes[i * nf + nName]] === want && MATCHED.has(nodeTypes[nodes[i * nf + nType]])) hits.push(i);
  const live = hits.filter((i) => parent[i] !== -1);
  hits.sort((a, b) => nodes[a * nf + nId] - nodes[b * nf + nId]);
  console.log(`\n== ${want}: ${hits.length} nodes, ${live.length} strongly reachable`);
  for (const i of hits.filter((h) => parent[h] !== -1).slice(0, Number(values.paths))) {
    const chain = [];
    for (let at = i; at !== 0; at = parent[at]) chain.push(`${nodeName(at)}  <-${edgeName(parentEdge[at])}-`);
    chain.push('(root)');
    console.log(`\n${chain.reverse().join('\n  ')}`);
  }
}
