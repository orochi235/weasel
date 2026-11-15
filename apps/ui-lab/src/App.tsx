import { Lab } from '@weasel-js/labkit';
import { useHashRoute } from '@shared/hashRoute';
import { BADGE_LAB, BADGE_OCTANTS_LAB, BADGE_SHAPES_LAB, LABS } from '@shared/labs';
import { ComposeInstrument } from './badge/compose/ComposeInstrument';
import { OctantsInstrument } from './badge/octants/OctantsInstrument';
import { ShapesInstrument } from './badge/shapes/ShapesInstrument';

const PAGES = {
  'badge-compose': { page: BADGE_LAB, instruments: [ComposeInstrument] },
  'badge-shapes': { page: BADGE_SHAPES_LAB, instruments: [ShapesInstrument] },
  'badge-octants': { page: BADGE_OCTANTS_LAB, instruments: [OctantsInstrument] },
} as const;
type Route = keyof typeof PAGES;
const ROUTES = Object.keys(PAGES) as Route[];

/** Each lab of ui's components, one page per hash route, switched from the title. */
export function App() {
  const route = useHashRoute(ROUTES, 'badge-compose');
  const { page, instruments } = PAGES[route];
  return (
    <Lab
      key={route}
      instruments={instruments}
      title={page.label}
      pages={LABS}
      path={page.href}
      storageKey={`ui-lab:${route}`}
      density="roomy"
    />
  );
}
