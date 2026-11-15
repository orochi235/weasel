// The host's default page script, `dist/page.global.js`: bundled with everything it imports into one
// classic script, because the page is `about:blank`, which cannot load modules.
import { serveHeadlessPage } from './page';

serveHeadlessPage();
