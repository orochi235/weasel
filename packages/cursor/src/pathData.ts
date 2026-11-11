/**
 * The authored path dialect's commands, each with its numbers, as both the fit guards and `placeCursorPath` read
 * them. `e` is an exponent, not a command, so a number like 1e-3 does not split, and `.5` and `1.5.5` read as SVG
 * reads them.
 */
export function* pathCommands(d: string): Generator<[cmd: string, nums: number[]]> {
  for (const [, cmd, args] of d.matchAll(/([A-DF-Za-df-z])([^A-DF-Za-df-z]*)/g)) {
    yield [cmd!, (args!.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number)];
  }
}
