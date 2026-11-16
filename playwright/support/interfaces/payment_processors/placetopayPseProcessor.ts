import { BaseProcessor } from './baseProcessor';

type APM = {
  id: Number;
  name: string;
  enabled: boolean;
};

interface PlacetopayPseProcessor extends BaseProcessor {}

// PlaceToPay PSE (dev) sandbox credentials required to register the processor via the API in tests.
// Confirmed with backend (api.dev.deuna.io) — dev/sandbox only, not production.
const placetopayPseProcessor: PlacetopayPseProcessor = {
  name: 'PLACETOPAY_PSE',
  payment_processor_id: 251,
  enabled: true,
  country_iso: 'CO',
  currency_iso3: 'COP',
  flow: 'payconnect',
  automatic_capture: true,
  enable_3ds_authentication: false,
  external_merchant_id: '4f274bc8a28a5aa82f7423e23543f29d',
  private_api_key: 'R077ZqN5sV4tgqdn',
  public_api_key: '4f274bc8a28a5aa82f7423e23543f29d',
};

export { placetopayPseProcessor };
