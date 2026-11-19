/// <reference types="vite/client" />
import { describeTeardown, storyCases } from '../testing/teardown';

// The stories of the components whose names begin T-Z; see `../testing/teardown.tsx`.
describeTeardown('every story releases what it registered once unmounted', await storyCases(import.meta.glob('./[T-Z]*/**/*.stories.tsx')), 60);
