/// <reference types="vite/client" />
import { describeTeardown, storyCases } from '../testing/teardown';

// The stories of the components whose names begin P-R; see `../testing/teardown.tsx`.
describeTeardown('every story releases what it registered once unmounted', await storyCases(import.meta.glob('./[P-R]*/**/*.stories.tsx')), 150);
