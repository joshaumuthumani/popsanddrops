import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// React Testing Library doesn't auto-clean when `globals: true` is combined with a custom
// setup file, and a leaked DOM between tests makes getByText ambiguous in confusing ways.
afterEach(cleanup);
