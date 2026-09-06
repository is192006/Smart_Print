process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
// Isolated from the real dev uploads directory (UPLOAD_DIR default is
// uploads/documents) so the test suite never reads/writes/pollutes it.
// src/config/env.ts reads this once at import time, so it must be set
// before any test file imports app/env/storage modules.
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR ?? 'tests/tmp-uploads';
