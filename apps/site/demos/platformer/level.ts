// apps/site/demos/platformer/level.ts

/** Side length of one tile, in world units. */
export const TILE = 24;

export const EMPTY = 0;
export const SOLID = 1;
export const ONEWAY = 2;
export const SPIKE = 3;

export interface Vec2 {
  x: number;
  y: number;
}

export interface Level {
  cols: number;
  rows: number;
  /** Geometry only, row-major, `cols * rows` entries. */
  tiles: Uint8Array;
  spawn: Vec2;
  goal: Vec2;
  coins: Vec2[];
  enemies: Vec2[];
  widthPx: number;
  heightPx: number;
}

const GEOMETRY: Record<string, number> = { '#': SOLID, '=': ONEWAY, '^': SPIKE };
const ENTITIES = new Set(['S', 'G', 'o', 'e']);

/**
 * `#` solid, `=` one-way platform, `^` spike, `o` coin, `e` enemy, `S` spawn,
 * `G` goal, `.` air. Entity glyphs leave air behind in the tile grid.
 */
export function parseLevel(lines: string[]): Level {
  const cols = lines[0]?.length ?? 0;
  if (lines.some((r) => r.length !== cols)) {
    throw new Error('parseLevel: ragged rows — every row must be the same length');
  }
  const level: Level = {
    cols,
    rows: lines.length,
    tiles: new Uint8Array(cols * lines.length),
    spawn: { x: 0, y: 0 },
    goal: { x: 0, y: 0 },
    coins: [],
    enemies: [],
    widthPx: cols * TILE,
    heightPx: lines.length * TILE,
  };
  const center = (cx: number, cy: number): Vec2 => ({ x: (cx + 0.5) * TILE, y: (cy + 0.5) * TILE });

  lines.forEach((row, cy) => {
    for (let cx = 0; cx < cols; cx++) {
      const ch = row[cx];
      const geom = GEOMETRY[ch];
      if (geom !== undefined) {
        level.tiles[cy * cols + cx] = geom;
        continue;
      }
      // A mistyped glyph would otherwise become air, and an 80-wide hand-authored
      // level makes that typo invisible until something falls through the floor.
      if (ch !== '.' && !ENTITIES.has(ch)) {
        throw new Error(`parseLevel: unknown glyph "${ch}" at column ${cx}, row ${cy}`);
      }
      if (ch === 'S') level.spawn = center(cx, cy);
      else if (ch === 'G') level.goal = center(cx, cy);
      else if (ch === 'o') level.coins.push(center(cx, cy));
      else if (ch === 'e') level.enemies.push(center(cx, cy));
    }
  });
  return level;
}

/**
 * The left and right edges read SOLID so a body can never walk out of the level.
 * Above and below read EMPTY: a jump near the ceiling is free, and falling off
 * the bottom must actually fall — a solid lower edge would catch the player on
 * an invisible floor and the out-of-bounds death could never fire.
 */
export function tileAt(level: Level, cx: number, cy: number): number {
  if (cy < 0 || cy >= level.rows) return EMPTY;
  if (cx < 0 || cx >= level.cols) return SOLID;
  return level.tiles[cy * level.cols + cx];
}

/** World x/y → tile column/row. */
export const toCol = (x: number): number => Math.floor(x / TILE);
export const toRow = (y: number): number => Math.floor(y / TILE);
