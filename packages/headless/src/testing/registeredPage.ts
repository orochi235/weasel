// A page script serving `registeredScene`'s options, for the browser tests' `renderInNode`.
import { serveHeadlessPage } from '../page';
import { REGISTERED_SCENE_OPTIONS } from './registeredScene';

serveHeadlessPage({ scene: REGISTERED_SCENE_OPTIONS });
