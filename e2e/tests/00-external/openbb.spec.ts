import { createExternalHealthSpec } from '@lifegence/e2e-common';

/**
 * Ensures the OpenBB API container is reachable (used by Stock Price
 * fetching via OpenBBClient). Starts it via docker compose if down.
 *
 * Override via env:
 *   OPENBB_URL           — default http://localhost:6900/
 *   OPENBB_COMPOSE_FILE  — default ~/work/openbb-project/docker/docker-compose.yml
 *   SKIP_EXTERNAL=1      — skip entirely
 */
createExternalHealthSpec([
  {
    name: 'OpenBB',
    healthUrl: process.env.OPENBB_URL || 'http://localhost:6900/',
    composeFile: process.env.OPENBB_COMPOSE_FILE,
  },
]);
