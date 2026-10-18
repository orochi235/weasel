/** Vertex data for the lab renderer's meshes: a unit cube, a unit sphere,
 *  and the ground grid's lines. */

export function cubeData(): { positions: number[]; normals: number[] } {
  const faces: Array<[number[], number[], number[], number[], number[]]> = [
    [[0, 0, 1], [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]],
    [[0, 0, -1], [0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]],
    [[1, 0, 0], [0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]],
    [[-1, 0, 0], [-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]],
    [[0, 1, 0], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]],
    [[0, -1, 0], [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]],
  ];
  const positions: number[] = [];
  const normals: number[] = [];
  for (const [normal, a, b, c, d] of faces) {
    for (const v of [a, b, c, a, c, d]) {
      positions.push(...v);
      normals.push(...normal);
    }
  }
  return { positions, normals };
}

export function sphereData(segments = 24, rings = 16): { positions: number[]; normals: number[] } {
  const positions: number[] = [];
  const normals: number[] = [];
  const at = (ring: number, seg: number): number[] => {
    const phi = (ring / rings) * Math.PI;
    const theta = (seg / segments) * Math.PI * 2;
    return [
      0.5 * Math.sin(phi) * Math.cos(theta),
      0.5 * Math.cos(phi),
      0.5 * Math.sin(phi) * Math.sin(theta),
    ];
  };
  for (let ring = 0; ring < rings; ring++) {
    for (let seg = 0; seg < segments; seg++) {
      const a = at(ring, seg);
      const b = at(ring + 1, seg);
      const c = at(ring + 1, seg + 1);
      const d = at(ring, seg + 1);
      for (const v of [a, c, b, a, d, c]) {
        positions.push(...v);
        const len = Math.hypot(v[0], v[1], v[2]) || 1;
        normals.push(v[0] / len, v[1] / len, v[2] / len);
      }
    }
  }
  return { positions, normals };
}

export function gridData(half = 8, step = 1): number[] {
  const lines: number[] = [];
  for (let i = -half; i <= half; i += step) {
    lines.push(i, 0, -half, i, 0, half);
    lines.push(-half, 0, i, half, 0, i);
  }
  return lines;
}
