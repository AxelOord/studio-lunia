import * as migration_20261004_164202_initial from './20261004_164202_initial';
import * as migration_20261004_175013_hosted_preview from './20261004_175013_hosted_preview';
import * as migration_20261005_065653_reusable_page_blocks from './20261005_065653_reusable_page_blocks';
import * as migration_20261005_145239_inquiry_attribution_funnel from './20261005_145239_inquiry_attribution_funnel';
import * as migration_20261005_181401_customer_records_email_history from './20261005_181401_customer_records_email_history';
import * as migration_20261005_211842_customer_followups from './20261005_211842_customer_followups';
import * as migration_20261005_231620_service_inquiry_landings from './20261005_231620_service_inquiry_landings';

export const migrations = [
  {
    up: migration_20261004_164202_initial.up,
    down: migration_20261004_164202_initial.down,
    name: '20261004_164202_initial',
  },
  {
    up: migration_20261004_175013_hosted_preview.up,
    down: migration_20261004_175013_hosted_preview.down,
    name: '20261004_175013_hosted_preview',
  },
  {
    up: migration_20261005_065653_reusable_page_blocks.up,
    down: migration_20261005_065653_reusable_page_blocks.down,
    name: '20261005_065653_reusable_page_blocks',
  },
  {
    up: migration_20261005_145239_inquiry_attribution_funnel.up,
    down: migration_20261005_145239_inquiry_attribution_funnel.down,
    name: '20261005_145239_inquiry_attribution_funnel',
  },
  {
    up: migration_20261005_181401_customer_records_email_history.up,
    down: migration_20261005_181401_customer_records_email_history.down,
    name: '20261005_181401_customer_records_email_history',
  },
  {
    up: migration_20261005_211842_customer_followups.up,
    down: migration_20261005_211842_customer_followups.down,
    name: '20261005_211842_customer_followups',
  },
  {
    up: migration_20261005_231620_service_inquiry_landings.up,
    down: migration_20261005_231620_service_inquiry_landings.down,
    name: '20261005_231620_service_inquiry_landings'
  },
];
