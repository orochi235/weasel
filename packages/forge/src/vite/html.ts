import { DEFAULT_TITLE } from '../title.ts';

const escaped = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The document forge serves for `entry`, one of its `virtual:forge/*-entry.js` modules. A build hands the
 * bare id to its own resolver; the dev server needs the `/@id/` form a browser can request.
 */
export function html(entry: string, mode: 'serve' | 'build' = 'serve', title: string = DEFAULT_TITLE): string {
  const src = `${mode === 'serve' ? '/@id/' : ''}virtual:forge/${entry}`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escaped(title)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${src}"></script>
  </body>
</html>
`;
}
