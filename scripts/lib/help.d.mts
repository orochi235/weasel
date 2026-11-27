export interface CliOption {
  type: 'boolean' | 'string';
  short?: string;
  multiple?: boolean;
  default?: boolean | string | boolean[] | string[];
  placeholder?: string;
  /** For a string option that may stand alone: the value a bare `--name` takes. Its value then goes only after `=`. */
  bare?: string;
  description: string;
}
export interface CliSpec {
  /** What the usage line calls the command; `node <path>` when left out. */
  name?: string;
  summary: string;
  /** The positionals as the usage line shows them; also how many it takes (see arityOf). */
  positionals?: string;
  options?: Record<string, CliOption>;
  passthrough?: boolean;
  notes?: string;
  commands?: Record<string, Omit<CliSpec, 'commands'>>;
}
export interface CliParse {
  command?: string;
  values: Record<string, boolean | string | Array<boolean | string> | undefined>;
  positionals: string[];
  rest: string[];
}
export function arityOf(positionals?: string): { min: number; max: number };
export function usageLineOf(name: string, spec: CliSpec): string;
export function helpOf(name: string, spec: CliSpec): string;
export function parseCli(name: string, spec: CliSpec, argv: string[]): { help: string } | { error: string } | CliParse;
export function cli(url: string, spec: CliSpec, argv?: string[]): CliParse;
