import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { build, createServer } from 'vite';
import { parseCli, USAGE } from './parse';

const cli = parseCli(process.argv.slice(2));

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
  if (cli.command === 'dev') {
    const server = await createServer({ configFile });
    await server.listen();
    server.printUrls();
  } else {
    await build({ configFile, ...(cli.out === undefined ? {} : { build: { outDir: resolve(cli.out) } }) });
  }
}
