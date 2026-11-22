/**
 * The `force` layout's full run, at the sizes it is meant for. Run on the fleet:
 * `onto do --kind bench -in weasel -- npm run bench:force`. Prints one JSON line per run as it
 * finishes, then a line per case with the median.
 */
import { graphOf, type GraphCluster, type GraphEdge, type GraphNode } from './graph';
import { force } from './force';

/** Each size run plain, and with its nodes in clusters of ten. */
const CASES = [50, 150, 300].flatMap((size) => [{ size, clustered: false }, { size, clustered: true }]);
const RUNS = 15;

/** A deterministic stream in [0, 1). */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function graphFor(size: number, clustered: boolean): ReturnType<typeof graphOf> {
  const rand = seeded(size);
  const nodes: GraphNode[] = Array.from({ length: size }, (_, i) => ({
    id: `n${i}`,
    bounds: { x: rand() * 2000, y: rand() * 2000, width: 60 + rand() * 60, height: 30 + rand() * 30 },
    pinned: false,
  }));
  const edges: GraphEdge[] = [];
  for (let i = 1; i < size; i++) {
    edges.push({ id: `t${i}`, from: `n${Math.floor(rand() * i)}`, to: `n${i}` });
    if (rand() < 0.3) edges.push({ id: `x${i}`, from: `n${Math.floor(rand() * size)}`, to: `n${i}` });
  }
  const clusters: GraphCluster[] = !clustered ? [] : Array.from({ length: Math.ceil(size / 10) }, (_, c) => ({
    id: `g${c}`,
    members: nodes.slice(c * 10, c * 10 + 10).map((n) => n.id),
    inset: { top: 12, right: 12, bottom: 12, left: 12 },
  }));
  return graphOf(nodes, edges, clusters);
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

CASES.forEach(({ size, clustered }, at) => {
  const name = `force-${size}${clustered ? '-clustered' : ''}`;
  const graph = graphFor(size, clustered);
  force(graph);
  const times: number[] = [];
  for (let run = 0; run < RUNS; run++) {
    const t0 = performance.now();
    force(graph);
    const ms = performance.now() - t0;
    times.push(ms);
    process.stdout.write(`${JSON.stringify({ case: name, run, ms })}\n`);
  }
  process.stdout.write(`${at + 1}/${CASES.length} ${name.padEnd(20)}  median ${median(times).toFixed(2).padStart(8)} ms  min ${Math.min(...times).toFixed(2).padStart(8)} ms\n`);
  process.stdout.write(`onto: progress ${at + 1}/${CASES.length}\n`);
});
