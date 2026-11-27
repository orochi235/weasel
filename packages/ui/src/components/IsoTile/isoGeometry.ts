/** A tile's front face, and how far its top and side faces recede, up and to the right. */
export interface IsoBox {
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
}

const pts = (...xy: number[]): string => {
  const out: string[] = [];
  for (let i = 0; i < xy.length; i += 2) out.push(`${xy[i]},${xy[i + 1]}`);
  return out.join(' ');
};

/** The top face's polygon points. */
export const topFaceOf = ({ x, y, width: w, depth: d }: IsoBox): string => pts(x, y, x + d, y - d, x + w + d, y - d, x + w, y);

/** The side face's polygon points. */
export const sideFaceOf = ({ x, y, width: w, height: h, depth: d }: IsoBox): string =>
  pts(x + w, y, x + w + d, y - d, x + w + d, y + h - d, x + w, y + h);

/** The outline around all three faces, as one hexagon. */
export const outlineOf = ({ x, y, width: w, height: h, depth: d }: IsoBox): string =>
  pts(x, y + h, x, y, x + d, y - d, x + w + d, y - d, x + w + d, y + h - d, x + w, y + h);
