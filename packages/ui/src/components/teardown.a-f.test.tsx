/// <reference types="vite/client" />
import { describeTeardown, storyCases } from '../testing/teardown';

// The stories of the components whose names begin A-F; see `../testing/teardown.tsx`.
describeTeardown('every story releases what it registered once unmounted', await storyCases(import.meta.glob('./[A-F]*/**/*.stories.tsx')), 180);
