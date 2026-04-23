import { createLegacyRedirectSpec } from '@lifegence/e2e-common';

createLegacyRedirectSpec({
  paths: [
    { legacy: '/app/stock-master', canonical: '/desk/stock-master' },
    { legacy: '/app/stock-price', canonical: '/desk/stock-price' },
  ],
});
