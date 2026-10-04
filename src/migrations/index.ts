import * as migration_20261004_164202_initial from './20261004_164202_initial';
import * as migration_20261004_175013_hosted_preview from './20261004_175013_hosted_preview';

export const migrations = [
  {
    up: migration_20261004_164202_initial.up,
    down: migration_20261004_164202_initial.down,
    name: '20261004_164202_initial',
  },
  {
    up: migration_20261004_175013_hosted_preview.up,
    down: migration_20261004_175013_hosted_preview.down,
    name: '20261004_175013_hosted_preview'
  },
];
