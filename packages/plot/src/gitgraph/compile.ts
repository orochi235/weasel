/** A gitgraph compiled to its scales and marks. */
import { CHART_PAD as PAD, chartTitle } from '../chartTitle';
import { barMark, pointMark } from '../marks/boxes';
import { lineMark, ruleMark } from '../marks/paths';
import { textMark } from '../marks/text';
import type { PlotMark, PlotPoint } from '../marks/types';
import type { PlotMeasure } from '../measure';
import { seriesColor, type PlotTheme } from '../theme';
import { replayGitGraph, type GitCommit, type GitHistory } from './replay';
import type { GitGraphData } from './types';

/** Where a gitgraph's parts landed: each lane's place across the run, and each commit's point. */
export interface GitGraphLayout {
  history: GitHistory;
  /** Each branch's place across the run, in `history.branches` order: a y for `'LR'`, an x otherwise. */
  lanes: readonly number[];
  /** Each commit's point, in `history.commits` order. */
  points: readonly PlotPoint[];
}

const RADIUS = 6;
const GAP = 6;
const MAX_STEP = 50;
const MAX_LANE = 60;

/** The lanes and commit points of `history` in `box`, commits in sequence along the run, lanes across it. */
function place(
  data: GitGraphData, history: GitHistory, box: { x: number; y: number; width: number; height: number }, labelRoom: number,
): GitGraphLayout {
  const dir = data.orientation ?? 'LR';
  const lr = dir === 'LR';
  const along = lr ? { start: box.x + labelRoom, size: box.width - labelRoom } : { start: box.y + (dir === 'TB' ? labelRoom : 0), size: box.height - labelRoom };
  const across = lr ? { start: box.y, size: box.height } : { start: box.x, size: box.width };
  const laneGap = Math.min(MAX_LANE, across.size / Math.max(1, history.branches.length));
  const lanes = history.branches.map((_, i) => across.start + (i + 0.5) * laneGap);
  const step = Math.min(MAX_STEP, Math.max(0, along.size) / Math.max(1, history.commits.length));
  const laneOf = new Map(history.branches.map((b, i) => [b.name, lanes[i]!]));
  const points = history.commits.map((c) => {
    const a = dir === 'BT' ? along.start + along.size - (c.seq + 0.5) * step : along.start + (c.seq + 0.5) * step;
    const x = laneOf.get(c.branch)!;
    return lr ? { x: a, y: x } : { x, y: a };
  });
  return { history, lanes, points };
}

/** The point on `lane` level with `p` along the run. */
const onLane = (lr: boolean, lane: number, p: PlotPoint): PlotPoint => (lr ? { x: p.x, y: lane } : { x: lane, y: p.y });

/** Each branch's line from its fork through its commits, and each merge and cherry-pick's link from its source. */
function lines(layout: GitGraphLayout, lr: boolean, theme: PlotTheme): PlotMark[] {
  const { history, lanes, points } = layout;
  const at = new Map(history.commits.map((c, i) => [c.id, points[i]!]));
  const laneIndex = new Map(history.branches.map((b, i) => [b.name, i]));
  const marks: PlotMark[] = [];
  history.branches.forEach((b, i) => {
    const own = b.commits.map((id) => at.get(id)!);
    const fork = b.fork === undefined ? undefined : at.get(b.fork);
    const path = fork !== undefined && own.length > 0 ? [fork, onLane(lr, lanes[i]!, fork), ...own] : own;
    if (path.length > 1) marks.push(lineMark({ key: `branch:${i}`, points: path, color: seriesColor(theme, i), datum: { branch: b.name } }));
  });
  for (const c of history.commits) {
    const from = c.source ?? (c.parents.length > 1 ? c.parents[1] : undefined);
    if (from === undefined) continue;
    const source = history.commits.find((x) => x.id === from)!;
    const lane = laneIndex.get(source.branch)!;
    const to = at.get(c.id)!;
    marks.push(lineMark({
      key: `${c.source !== undefined ? 'pick' : 'merge'}:${c.command}`, points: [at.get(from)!, onLane(lr, lanes[lane]!, to), to],
      color: seriesColor(theme, lane), datum: { command: c.command }, ...(c.source !== undefined ? { dash: [4, 3] } : {}),
    }));
  }
  return marks;
}

/** A commit's dot, a square to stand out, or a crossed dot for a revert. */
function commitMarks(c: GitCommit, p: PlotPoint, color: string, theme: PlotTheme): PlotMark[] {
  const key = `commit:${c.command}`;
  const datum = { command: c.command };
  if (c.type === 'HIGHLIGHT') return [barMark({ key, x: p.x - RADIUS, width: 2 * RADIUS, from: p.y - RADIUS, to: p.y + RADIUS, color, datum })];
  const dot = pointMark({ key, ...p, radius: RADIUS, color, datum });
  if (c.type !== 'REVERSE') return [dot];
  const r = RADIUS * 0.7;
  return [
    dot,
    ruleMark({ key: `${key}:cross:0`, from: { x: p.x - r, y: p.y - r }, to: { x: p.x + r, y: p.y + r }, color: theme.text, width: 2 }),
    ruleMark({ key: `${key}:cross:1`, from: { x: p.x - r, y: p.y + r }, to: { x: p.x + r, y: p.y - r }, color: theme.text, width: 2 }),
  ];
}

/** A commit's id where its command gave one, and its tag: below and above it running across, right and left running down. */
function commitLabels(data: GitGraphData, c: GitCommit, p: PlotPoint, lr: boolean, theme: PlotTheme, measure: PlotMeasure): PlotMark[] {
  const cmd = data.commands[c.command]!;
  const small = { ...theme.font, fontSize: Math.round(theme.font.fontSize * 0.85) };
  const off = RADIUS + 3;
  const marks: PlotMark[] = [];
  if ((cmd.kind === 'commit' || cmd.kind === 'merge') && cmd.id !== undefined) {
    marks.push(textMark({
      key: `commit:${c.command}:id`, text: cmd.id, font: small, color: theme.text, measure,
      ...(lr ? { x: p.x, y: p.y + off, baseline: 'top' as const } : { x: p.x + off, y: p.y, anchor: 'start' as const }),
    }));
  }
  if (cmd.kind !== 'branch' && cmd.kind !== 'checkout' && cmd.tag !== undefined) {
    marks.push(textMark({
      key: `commit:${c.command}:tag`, text: cmd.tag, font: theme.font, color: theme.text, measure, bold: true, datum: { edit: 'tag', command: c.command },
      ...(lr ? { x: p.x, y: p.y - off, baseline: 'bottom' as const } : { x: p.x - off, y: p.y, anchor: 'end' as const }),
    }));
  }
  return marks;
}

/** Lays out a gitgraph in a box of `size`: its title, a lane per branch with its name, commits along it, merge links. */
export function compileGitGraph(
  data: GitGraphData, size: { width: number; height: number }, theme: PlotTheme, measure: PlotMeasure,
): { marks: PlotMark[]; layout: GitGraphLayout } {
  const { marks, top } = chartTitle(data.title, size.width, theme, measure);
  const dir = data.orientation ?? 'LR';
  const lr = dir === 'LR';
  const history = replayGitGraph(data);
  const names = history.branches.map((b) => measure(b.name, theme.font));
  const labelRoom = GAP + Math.max(0, ...names.map((s) => (lr ? s.width : s.height)));
  const box = { x: PAD, y: top, width: Math.max(1, size.width - 2 * PAD), height: Math.max(1, size.height - PAD - top) };
  const layout = place(data, history, box, labelRoom);
  marks.push(...lines(layout, lr, theme));
  history.commits.forEach((c, i) => {
    const lane = history.branches.findIndex((b) => b.name === c.branch);
    marks.push(...commitMarks(c, layout.points[i]!, seriesColor(theme, lane), theme));
  });
  history.commits.forEach((c, i) => marks.push(...commitLabels(data, c, layout.points[i]!, lr, theme, measure)));
  history.branches.forEach((b, i) => {
    const lane = layout.lanes[i]!;
    const at = lr ? { x: box.x, y: lane, anchor: 'start' as const }
      : { x: lane, y: dir === 'TB' ? box.y : box.y + box.height, baseline: dir === 'TB' ? 'top' as const : 'bottom' as const };
    marks.push(textMark({ key: `branch:${i}:label`, text: b.name, ...at, font: theme.font, color: seriesColor(theme, i), measure, bold: true, datum: { branch: b.name } }));
  });
  return { marks, layout };
}
