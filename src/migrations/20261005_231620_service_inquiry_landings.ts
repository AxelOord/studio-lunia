import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_services_items" ADD COLUMN "inclusions" varchar;
  ALTER TABLE "pages_blocks_services_items" ADD COLUMN "price_guidance" varchar;
  ALTER TABLE "pages_blocks_services_items" ADD COLUMN "response_expectation" varchar;
  ALTER TABLE "pages" ADD COLUMN "inquiry_service" varchar;
  ALTER TABLE "_pages_v_blocks_services_items" ADD COLUMN "inclusions" varchar;
  ALTER TABLE "_pages_v_blocks_services_items" ADD COLUMN "price_guidance" varchar;
  ALTER TABLE "_pages_v_blocks_services_items" ADD COLUMN "response_expectation" varchar;
  ALTER TABLE "_pages_v" ADD COLUMN "version_inquiry_service" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_services_items" DROP COLUMN "inclusions";
  ALTER TABLE "pages_blocks_services_items" DROP COLUMN "price_guidance";
  ALTER TABLE "pages_blocks_services_items" DROP COLUMN "response_expectation";
  ALTER TABLE "pages" DROP COLUMN "inquiry_service";
  ALTER TABLE "_pages_v_blocks_services_items" DROP COLUMN "inclusions";
  ALTER TABLE "_pages_v_blocks_services_items" DROP COLUMN "price_guidance";
  ALTER TABLE "_pages_v_blocks_services_items" DROP COLUMN "response_expectation";
  ALTER TABLE "_pages_v" DROP COLUMN "version_inquiry_service";`)
}
