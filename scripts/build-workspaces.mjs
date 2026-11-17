// `npm run build`: builds every published workspace, several at once, each once the siblings it
// depends on have built. The order comes from the manifests, so a new package needs no entry here.
// At the first failure it starts nothing more, lets the running builds finish, and exits with the
// failed build's code. `npm run build -w a -w b …` carries on past a failure, so every dependent fails
// too and the log ends on a downstream TS7016 instead of the cause.
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { exitUnlessOwnInstall } from './lib/own-install.mjs';
import { publishableWorkspaces } from './lib/workspaces.mjs';

/** Builds that read another package's `dist` without declaring it: labkit's `styles.css` copies ui-canvas's CSS. */
export const BUILD_AFTER = { '@weasel-js/labkit': ['@weasel-js/ui-canvas'] };

/** Each published workspace and the siblings that must build before it. */
export function buildGraph(manifests, after = BUILD_AFTER) {
  const names = new Set(manifests.map((m) => m.name));
  return new Map(
    manifests.map((m) => [
      m.name,
      [...new Set([...Object.keys({ ...m.dependencies, ...m.peerDependencies }), ...(after[m.name] ?? [])])].filter(
        (dep) => dep !== m.name && names.has(dep),
      ),
    ]),
  );
}

/**
 * Builds every name in `graph` with `build`, at most `jobs` at once, each after its dependencies.
 * Longest remaining chain first, so the critical path never waits behind a leaf.
 * @returns the workspace that failed and its exit code, or null when all built.
 */
export async function buildAll(graph, build, jobs) {
  const depth = new Map();
  const chain = (name, seen = new Set()) => {
    if (depth.has(name)) return depth.get(name);
    if (seen.has(name)) throw new Error(`[build] dependency cycle through ${[...seen, name].join(' → ')}`);
    seen.add(name);
    const d = 1 + Math.max(0, ...[...graph].filter(([, deps]) => deps.includes(name)).map(([n]) => chain(n, seen)));
    seen.delete(name);
    depth.set(name, d);
    return d;
  };
  const waiting = [...graph.keys()].sort((a, b) => chain(b) - chain(a));
  const built = new Set();
  const running = new Map();
  let failed = null;
  while (waiting.length > 0 || running.size > 0) {
    if (!failed) {
      for (let i = 0; i < waiting.length && running.size < jobs; ) {
        const name = waiting[i];
        if (!graph.get(name).every((dep) => built.has(dep))) {
          i++;
          continue;
        }
        waiting.splice(i, 1);
        running.set(name, Promise.resolve(build(name)).then((code) => ({ name, code })));
      }
      if (running.size === 0) throw new Error(`[build] nothing can start: ${waiting.join(', ')} wait on each other`);
    } else if (running.size === 0) break;
    const { name, code } = await Promise.race(running.values());
    running.delete(name);
    if (code === 0) built.add(name);
    else failed ??= { name, code };
  }
  return failed;
}

const npmBuild = (name, total, built) => {
  const started = Date.now();
  return new Promise((done) => {
    const child = spawn('npm', ['run', 'build', '-w', name], { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => chunks.push(chunk));
    child.on('close', (status) => {
      const code = status ?? 1;
      if (code !== 0) process.stdout.write(Buffer.concat(chunks));
      built.count++;
      const secs = ((Date.now() - started) / 1000).toFixed(1).padStart(5);
      console.log(`[build] ${String(built.count).padStart(String(total).length)}/${total} ${code ? 'FAIL' : 'ok  '} ${secs}s  ${name}`);
      done(code);
    });
  });
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  exitUnlessOwnInstall(fileURLToPath(new URL('..', import.meta.url)));
  const graph = buildGraph(publishableWorkspaces().map(({ manifest }) => manifest));
  const jobs = Number(process.env.WEASEL_BUILD_JOBS) || Math.min(6, availableParallelism());
  const built = { count: 0 };
  const failed = await buildAll(graph, (name) => npmBuild(name, graph.size, built), jobs);
  if (failed) {
    console.error(`\n[build] ${failed.name} failed (exit ${failed.code}); started nothing after it.`);
    process.exit(failed.code);
  }
}
