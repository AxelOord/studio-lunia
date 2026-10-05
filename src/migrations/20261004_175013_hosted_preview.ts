import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "lunia_rate_limits" (
     "key" varchar PRIMARY KEY, "attempts" integer NOT NULL, "expires_at" timestamptz NOT NULL
   );
   CREATE INDEX "lunia_rate_limits_expiry_idx" ON "lunia_rate_limits" ("expires_at");
   ALTER TABLE "media" ADD COLUMN "prefix" varchar DEFAULT 'preview-media';
  ALTER TABLE "media" ADD COLUMN "_objectkey" varchar;
  ALTER TABLE "_media_v" ADD COLUMN "version_prefix" varchar DEFAULT 'preview-media';
  ALTER TABLE "_media_v" ADD COLUMN "version__objectkey" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "lunia_rate_limits";
   ALTER TABLE "media" DROP COLUMN "prefix";
  ALTER TABLE "media" DROP COLUMN "_objectkey";
  ALTER TABLE "_media_v" DROP COLUMN "version_prefix";
  ALTER TABLE "_media_v" DROP COLUMN "version__objectkey";`)
}
