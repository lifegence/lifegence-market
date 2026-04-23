import * as path from 'path';
import { createOrphanDocTypeSpec } from '@lifegence/e2e-common';
import { KNOWN_UI_HIDDEN_DOCTYPES } from '../../fixtures/coverage-allowlist';

createOrphanDocTypeSpec({
  modules: ['Market Data'],
  appRoot: path.resolve(__dirname, '../../../lifegence_market'),
  entryPoints: ['/desk', '/desk/market-dashboard', '/desk/stock-master'],
  allowlist: KNOWN_UI_HIDDEN_DOCTYPES,
});
