/// <reference types="vite/client" />
import { describeTeardown, storyCases } from '../testing/teardown';

// The stories of the components whose names begin S; see `../testing/teardown.tsx`.
describeTeardown('every story releases what it registered once unmounted', await storyCases(import.meta.glob('./S*/**/*.stories.tsx')), 75);
