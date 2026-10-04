import * as migration_20261004_164202_initial from './20261004_164202_initial';

export const migrations = [
  {
    up: migration_20261004_164202_initial.up,
    down: migration_20261004_164202_initial.down,
    name: '20261004_164202_initial'
  },
];
