type Mode = 'library' | 'app';

/** The bundlers whose hooks each mode needs. Every other unplugin adapter is refused. */
const BUNDLERS: Record<Mode, readonly string[]> = {
  app: ['vite', 'rollup', 'rolldown'],
  library: ['vite', 'rollup', 'rolldown', 'esbuild'],
};

/** Throws unless `framework` runs every hook `mode` relies on. */
export function assertBundler(mode: Mode, framework: string): void {
  const allowed = BUNDLERS[mode];
  if (!allowed) throw new Error(`weaselIcons: mode must be 'library' or 'app', not ${JSON.stringify(mode)}`);
  if (allowed.includes(framework)) return;
  const why = mode === 'app' ? '; its virtual modules would ship as unfilled placeholders' : '';
  throw new Error(`weaselIcons: ${mode} mode runs under ${allowed.join(', ')}, not ${framework}${why}`);
}
