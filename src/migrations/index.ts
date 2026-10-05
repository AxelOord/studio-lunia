import * as migration_20261004_164202_initial from './20261004_164202_initial';
import * as migration_20261004_175013_hosted_preview from './20261004_175013_hosted_preview';
import * as migration_20261005_065653_reusable_page_blocks from './20261005_065653_reusable_page_blocks';
import * as migration_20261005_145239_inquiry_attribution_funnel from './20261005_145239_inquiry_attribution_funnel';

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
    name: '20261005_145239_inquiry_attribution_funnel'
  },
];
