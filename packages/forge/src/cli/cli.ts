import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { build, createServer, loadConfigFromFile } from 'vite';
import { parseCli, USAGE } from './parse';
import { formatError, outDirPolicy } from './policy';

const cli = parseCli(process.argv.slice(2));

async function run(configFile: string): Promise<void> {
  if (cli.command === 'dev') {
    const server = await createServer({ configFile });
    await server.listen();
    server.printUrls();
    return;
  }
  if (cli.command !== 'build') return;
  if (cli.out === undefined) {
    await build({ configFile });
    return;
  }
  const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, configFile);
  const cwd = process.cwd();
  const policy = outDirPolicy(cli.out, cwd, loaded?.config.root ?? cwd);
  if (!policy.ok) {
    console.error(`weaselforge: ${policy.reason}\n\n${USAGE}`);
    process.exit(2);
  }
  await build({ configFile, build: { outDir: policy.outDir, emptyOutDir: policy.emptyOutDir } });
}

if (cli.command === 'help') {
  console.log(USAGE);
} else if (cli.command === 'usage') {
  console.error(`weaselforge: ${cli.error}\n\n${USAGE}`);
  process.exit(2);
} else {
  const configFile = resolve(cli.config);
  if (!existsSync(configFile)) {
    console.error(`weaselforge: no vite config at ${configFile}`);
    process.exit(1);
  }
  try {
    await run(configFile);
  } catch (error) {
    console.error(formatError(error, process.env));
    process.exit(1);
  }
}
