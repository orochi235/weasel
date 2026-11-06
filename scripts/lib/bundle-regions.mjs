/**
 * The copies of one module inside a pre-bundled Vite dependency file. Vite 8's rolldown optimizer
 * wraps each module in `//#region <path>` … `//#endregion`; esbuild, before it, put a `// <path>`
 * line above each and no end marker. Paths are relative to the server's root, so a leading `../`
 * climbs out of an app's directory.
 */
const REGION = /^\/\/#region (\S+)$/;
const ESBUILD = /^\/\/ (\S+\.(?:[cm]?[jt]sx?|json|css))$/;
const END = '//#endregion';

/** Each copy of `modulePath` (repo-relative, `/`-separated) in `body`, as the text of its region. */
export function moduleRegions(body, modulePath) {
  const regions = [];
  let current;
  for (const line of body.split('\n')) {
    const start = REGION.exec(line)?.[1] ?? ESBUILD.exec(line)?.[1];
    if (start !== undefined || line === END) {
      if (current) regions.push(current.join('\n'));
      current = start !== undefined && start.replace(/^(?:\.\.\/)+/, '') === modulePath ? [] : undefined;
      continue;
    }
    current?.push(line);
  }
  if (current) regions.push(current.join('\n'));
  return regions;
}
