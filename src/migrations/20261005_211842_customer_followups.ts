import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_follow_ups_purpose" AS ENUM('enquiry_followup', 'preparation', 'session_reminder');
  CREATE TYPE "public"."enum_follow_ups_state" AS ENUM('planned', 'blocked', 'paused', 'cancelled', 'simulated', 'failed');
  CREATE TYPE "public"."enum_follow_up_rules_purpose" AS ENUM('enquiry_followup', 'preparation', 'session_reminder');
  CREATE TYPE "public"."enum_incoming_replies_source" AS ENUM('simulation', 'verified_provider');
  CREATE TYPE "public"."enum_incoming_replies_state" AS ENUM('matched', 'review');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'simulateFollowUp');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_log_parent_task_slug" AS ENUM('inline', 'simulateFollowUp');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'simulateFollowUp');
  CREATE TABLE "follow_ups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"contact_id" integer NOT NULL,
  	"enquiry_id" integer NOT NULL,
  	"booking_id" integer,
  	"template_id" integer NOT NULL,
  	"rule_id" integer,
  	"purpose" "enum_follow_ups_purpose" NOT NULL,
  	"trigger_key" varchar NOT NULL,
  	"triggered_at" timestamp(3) with time zone NOT NULL,
  	"revision" numeric DEFAULT 1 NOT NULL,
  	"planned_at" timestamp(3) with time zone NOT NULL,
  	"time_zone" varchar NOT NULL,
  	"session_snapshot" timestamp(3) with time zone,
  	"recipient" varchar NOT NULL,
  	"subject" varchar NOT NULL,
  	"text" varchar NOT NULL,
  	"html" varchar NOT NULL,
  	"template_snapshot" jsonb NOT NULL,
  	"state" "enum_follow_ups_state" DEFAULT 'planned' NOT NULL,
  	"block_reason" varchar,
  	"job_i_d" numeric,
  	"attempts" numeric DEFAULT 0 NOT NULL,
  	"outcome_key" varchar,
  	"simulated_at" timestamp(3) with time zone,
  	"last_error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "follow_up_rules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"purpose" "enum_follow_up_rules_purpose" NOT NULL,
  	"template_id" integer NOT NULL,
  	"hours" numeric NOT NULL,
  	"time_zone" varchar NOT NULL,
  	"approved_for_tests" boolean DEFAULT false,
  	"revision" numeric DEFAULT 1 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "incoming_replies" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"event_key" varchar NOT NULL,
  	"summary" varchar NOT NULL,
  	"contact_id" integer,
  	"enquiry_id" integer,
  	"source" "enum_incoming_replies_source" NOT NULL,
  	"state" "enum_incoming_replies_state" NOT NULL,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"text" varchar,
  	"review_reason" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb NOT NULL,
  	"output" jsonb,
  	"state" "enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb,
  	"parent_task_slug" "enum_payload_jobs_log_parent_task_slug",
  	"parent_task_i_d" varchar
  );
  
  CREATE TABLE "payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"meta" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing_until" timestamp(3) with time zone,
  	"processing_token" varchar,
  	"concurrency_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_jobs_stats" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"stats" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "contacts" ADD COLUMN "follow_ups_stopped" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "follow_ups_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "follow_up_rules_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "incoming_replies_id" integer;
  ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_rule_id_follow_up_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."follow_up_rules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "follow_up_rules" ADD CONSTRAINT "follow_up_rules_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "incoming_replies" ADD CONSTRAINT "incoming_replies_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "incoming_replies" ADD CONSTRAINT "incoming_replies_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "follow_ups_contact_idx" ON "follow_ups" USING btree ("contact_id");
  CREATE INDEX "follow_ups_enquiry_idx" ON "follow_ups" USING btree ("enquiry_id");
  CREATE INDEX "follow_ups_booking_idx" ON "follow_ups" USING btree ("booking_id");
  CREATE INDEX "follow_ups_template_idx" ON "follow_ups" USING btree ("template_id");
  CREATE INDEX "follow_ups_rule_idx" ON "follow_ups" USING btree ("rule_id");
  CREATE UNIQUE INDEX "follow_ups_trigger_key_idx" ON "follow_ups" USING btree ("trigger_key");
  CREATE INDEX "follow_ups_planned_at_idx" ON "follow_ups" USING btree ("planned_at");
  CREATE INDEX "follow_ups_state_idx" ON "follow_ups" USING btree ("state");
  CREATE UNIQUE INDEX "follow_ups_outcome_key_idx" ON "follow_ups" USING btree ("outcome_key");
  CREATE INDEX "follow_ups_updated_at_idx" ON "follow_ups" USING btree ("updated_at");
  CREATE INDEX "follow_ups_created_at_idx" ON "follow_ups" USING btree ("created_at");
  CREATE INDEX "follow_up_rules_template_idx" ON "follow_up_rules" USING btree ("template_id");
  CREATE INDEX "follow_up_rules_updated_at_idx" ON "follow_up_rules" USING btree ("updated_at");
  CREATE INDEX "follow_up_rules_created_at_idx" ON "follow_up_rules" USING btree ("created_at");
  CREATE UNIQUE INDEX "incoming_replies_event_key_idx" ON "incoming_replies" USING btree ("event_key");
  CREATE INDEX "incoming_replies_contact_idx" ON "incoming_replies" USING btree ("contact_id");
  CREATE INDEX "incoming_replies_enquiry_idx" ON "incoming_replies" USING btree ("enquiry_id");
  CREATE INDEX "incoming_replies_updated_at_idx" ON "incoming_replies" USING btree ("updated_at");
  CREATE INDEX "incoming_replies_created_at_idx" ON "incoming_replies" USING btree ("created_at");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_until_idx" ON "payload_jobs" USING btree ("processing_until");
  CREATE INDEX "payload_jobs_concurrency_key_idx" ON "payload_jobs" USING btree ("concurrency_key");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload_jobs" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_follow_ups_fk" FOREIGN KEY ("follow_ups_id") REFERENCES "public"."follow_ups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_follow_up_rules_fk" FOREIGN KEY ("follow_up_rules_id") REFERENCES "public"."follow_up_rules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_incoming_replies_fk" FOREIGN KEY ("incoming_replies_id") REFERENCES "public"."incoming_replies"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_follow_ups_id_idx" ON "payload_locked_documents_rels" USING btree ("follow_ups_id");
  CREATE INDEX "payload_locked_documents_rels_follow_up_rules_id_idx" ON "payload_locked_documents_rels" USING btree ("follow_up_rules_id");
  CREATE INDEX "payload_locked_documents_rels_incoming_replies_id_idx" ON "payload_locked_documents_rels" USING btree ("incoming_replies_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "follow_ups" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "follow_up_rules" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "incoming_replies" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs_stats" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "follow_ups" CASCADE;
  DROP TABLE "follow_up_rules" CASCADE;
  DROP TABLE "incoming_replies" CASCADE;
  DROP TABLE "payload_jobs_log" CASCADE;
  DROP TABLE "payload_jobs" CASCADE;
  DROP TABLE "payload_jobs_stats" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_follow_ups_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_follow_up_rules_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_incoming_replies_fk";
  
  DROP INDEX "payload_locked_documents_rels_follow_ups_id_idx";
  DROP INDEX "payload_locked_documents_rels_follow_up_rules_id_idx";
  DROP INDEX "payload_locked_documents_rels_incoming_replies_id_idx";
  ALTER TABLE "contacts" DROP COLUMN "follow_ups_stopped";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "follow_ups_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "follow_up_rules_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "incoming_replies_id";
  DROP TYPE "public"."enum_follow_ups_purpose";
  DROP TYPE "public"."enum_follow_ups_state";
  DROP TYPE "public"."enum_follow_up_rules_purpose";
  DROP TYPE "public"."enum_incoming_replies_source";
  DROP TYPE "public"."enum_incoming_replies_state";
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  DROP TYPE "public"."enum_payload_jobs_log_state";
  DROP TYPE "public"."enum_payload_jobs_log_parent_task_slug";
  DROP TYPE "public"."enum_payload_jobs_task_slug";`)
}
