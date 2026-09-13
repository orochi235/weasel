/** The document forge serves for `entry`, one of its `virtual:forge/*-entry.js` modules. */
export function html(entry: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>weaselforge</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/@id/virtual:forge/${entry}"></script>
  </body>
</html>
`;
}
