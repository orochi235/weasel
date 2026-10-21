/** The row each span takes: the first where it clears everything already there by `gap`. */
export function staggerRows(spans: readonly { start: number; end: number }[], gap: number): number[] {
  const order = spans.map((_, i) => i).sort((a, b) => spans[a]!.start - spans[b]!.start);
  const rightEdges: number[] = [];
  const rows: number[] = new Array(spans.length).fill(0);
  for (const i of order) {
    const { start, end } = spans[i]!;
    let at = rightEdges.findIndex((right) => start >= right + gap);
    if (at < 0) at = rightEdges.push(0) - 1;
    rightEdges[at] = end;
    rows[i] = at;
  }
  return rows;
}
