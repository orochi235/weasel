import { configure } from '@testing-library/react';

// Testing Library's `waitFor` and `findBy*` give up after one second, the same default the
// `browser` project already raises for `expect.poll`.
configure({ asyncUtilTimeout: 5000 });
