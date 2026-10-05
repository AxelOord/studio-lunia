import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE lunia_measurement_events (event_key varchar PRIMARY KEY NOT NULL, expires_at timestamptz NOT NULL);
   CREATE INDEX lunia_measurement_events_expiry_idx ON lunia_measurement_events (expires_at);
   CREATE TYPE "public"."enum_enquiries_follow_up" AS ENUM('new', 'contacted', 'closed');
  CREATE TYPE "public"."enum_enquiries_notification_status" AS ENUM('pending', 'sending', 'accepted', 'failed', 'disabled', 'manual');
  CREATE TABLE "enquiries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"service_id" varchar NOT NULL,
  	"service_title" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"message" varchar NOT NULL,
  	"follow_up" "enum_enquiries_follow_up" DEFAULT 'new' NOT NULL,
  	"submission_hash" varchar NOT NULL,
  	"content_hash" varchar NOT NULL,
  	"attribution" jsonb NOT NULL,
  	"notification_status" "enum_enquiries_notification_status" DEFAULT 'pending' NOT NULL,
  	"notification_attempts" numeric DEFAULT 0 NOT NULL,
  	"notification_attempted_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "enquiries_id" integer;
  CREATE UNIQUE INDEX "enquiries_submission_hash_idx" ON "enquiries" USING btree ("submission_hash");
  CREATE INDEX "enquiries_updated_at_idx" ON "enquiries" USING btree ("updated_at");
  CREATE INDEX "enquiries_created_at_idx" ON "enquiries" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_enquiries_fk" FOREIGN KEY ("enquiries_id") REFERENCES "public"."enquiries"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_enquiries_id_idx" ON "payload_locked_documents_rels" USING btree ("enquiries_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE lunia_measurement_events;
   ALTER TABLE "enquiries" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "enquiries" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_enquiries_fk";
  
  DROP INDEX "payload_locked_documents_rels_enquiries_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "enquiries_id";
  DROP TYPE "public"."enum_enquiries_follow_up";
  DROP TYPE "public"."enum_enquiries_notification_status";`)
}
