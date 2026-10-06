import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_studio_days_blocks_image_text_image_side" AS ENUM('left', 'right');
  CREATE TYPE "public"."enum_studio_days_confirmation_mode" AS ENUM('immediate', 'manual');
  CREATE TYPE "public"."enum_studio_days_day_state" AS ENUM('scheduled', 'cancelled');
  CREATE TYPE "public"."enum_studio_days_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__studio_days_v_blocks_image_text_image_side" AS ENUM('left', 'right');
  CREATE TYPE "public"."enum__studio_days_v_version_confirmation_mode" AS ENUM('immediate', 'manual');
  CREATE TYPE "public"."enum__studio_days_v_version_day_state" AS ENUM('scheduled', 'cancelled');
  CREATE TYPE "public"."enum__studio_days_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_bookings_studio_message_state" AS ENUM('pending', 'ready', 'failed');
  ALTER TYPE "public"."enum_bookings_source" ADD VALUE 'studio_slot';
  ALTER TYPE "public"."enum_bookings_status" ADD VALUE 'pending_approval' BEFORE 'confirmed';
  CREATE TABLE "studio_days_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"body" varchar,
  	"image_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "studio_days_blocks_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "studio_days_blocks_gallery_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer
  );
  
  CREATE TABLE "studio_days_blocks_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "studio_days_blocks_image_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" varchar,
  	"image_id" integer,
  	"image_side" "enum_studio_days_blocks_image_text_image_side" DEFAULT 'left',
  	"block_name" varchar
  );
  
  CREATE TABLE "studio_days_blocks_services_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"body" varchar,
  	"inclusions" varchar,
  	"price_guidance" varchar,
  	"response_expectation" varchar
  );
  
  CREATE TABLE "studio_days_blocks_services" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "studio_days_blocks_call_to_action" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" varchar,
  	"label" varchar,
  	"href" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "studio_days" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"location" varchar,
  	"offer_title" varchar,
  	"inclusions" varchar,
  	"price_minor" numeric,
  	"currency" varchar,
  	"change_policy" varchar,
  	"local_date" varchar,
  	"time_zone" varchar,
  	"opens_local" varchar,
  	"open_offset" numeric,
  	"closes_local" varchar,
  	"close_offset" numeric,
  	"duration_minutes" numeric,
  	"buffer_minutes" numeric,
  	"capacity" numeric,
  	"booking_deadline_local" varchar,
  	"deadline_offset" numeric,
  	"confirmation_mode" "enum_studio_days_confirmation_mode" DEFAULT 'immediate',
  	"bookings_open" boolean DEFAULT false,
  	"day_state" "enum_studio_days_day_state" DEFAULT 'scheduled',
  	"acknowledge_bookings" boolean,
  	"schedule_revision" numeric DEFAULT 0,
  	"configuration_hash" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_studio_days_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_studio_days_v_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"body" varchar,
  	"image_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_studio_days_v_blocks_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_studio_days_v_blocks_gallery_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_studio_days_v_blocks_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_studio_days_v_blocks_image_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" varchar,
  	"image_id" integer,
  	"image_side" "enum__studio_days_v_blocks_image_text_image_side" DEFAULT 'left',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_studio_days_v_blocks_services_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"body" varchar,
  	"inclusions" varchar,
  	"price_guidance" varchar,
  	"response_expectation" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_studio_days_v_blocks_services" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_studio_days_v_blocks_call_to_action" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" varchar,
  	"label" varchar,
  	"href" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_studio_days_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_location" varchar,
  	"version_offer_title" varchar,
  	"version_inclusions" varchar,
  	"version_price_minor" numeric,
  	"version_currency" varchar,
  	"version_change_policy" varchar,
  	"version_local_date" varchar,
  	"version_time_zone" varchar,
  	"version_opens_local" varchar,
  	"version_open_offset" numeric,
  	"version_closes_local" varchar,
  	"version_close_offset" numeric,
  	"version_duration_minutes" numeric,
  	"version_buffer_minutes" numeric,
  	"version_capacity" numeric,
  	"version_booking_deadline_local" varchar,
  	"version_deadline_offset" numeric,
  	"version_confirmation_mode" "enum__studio_days_v_version_confirmation_mode" DEFAULT 'immediate',
  	"version_bookings_open" boolean DEFAULT false,
  	"version_day_state" "enum__studio_days_v_version_day_state" DEFAULT 'scheduled',
  	"version_acknowledge_bookings" boolean,
  	"version_schedule_revision" numeric DEFAULT 0,
  	"version_configuration_hash" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__studio_days_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "studio_slots" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"day_id" integer NOT NULL,
  	"revision" numeric NOT NULL,
  	"slot_key" varchar NOT NULL,
  	"starts_at" timestamp(3) with time zone NOT NULL,
  	"ends_at" timestamp(3) with time zone NOT NULL,
  	"occupied_until" timestamp(3) with time zone NOT NULL,
  	"capacity" numeric NOT NULL,
  	"snapshot" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "follow_ups" ALTER COLUMN "enquiry_id" DROP NOT NULL;
  ALTER TABLE "bookings" ALTER COLUMN "enquiry_id" DROP NOT NULL;
  ALTER TABLE "bookings" ADD COLUMN "studio_day_id" integer;
  ALTER TABLE "bookings" ADD COLUMN "studio_slot_id" integer;
  ALTER TABLE "bookings" ADD COLUMN "studio_seat" numeric;
  ALTER TABLE "bookings" ADD COLUMN "studio_revision" numeric;
  ALTER TABLE "bookings" ADD COLUMN "studio_snapshot" jsonb;
  ALTER TABLE "bookings" ADD COLUMN "session_ends_at" timestamp(3) with time zone;
  ALTER TABLE "bookings" ADD COLUMN "occupied_until" timestamp(3) with time zone;
  ALTER TABLE "bookings" ADD COLUMN "studio_submission_hash" varchar;
  ALTER TABLE "bookings" ADD COLUMN "studio_content_hash" varchar;
  ALTER TABLE "bookings" ADD COLUMN "studio_message_state" "enum_bookings_studio_message_state";
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "studio_days_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "studio_slots_id" integer;
  ALTER TABLE "studio_days_blocks_hero" ADD CONSTRAINT "studio_days_blocks_hero_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "studio_days_blocks_hero" ADD CONSTRAINT "studio_days_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."studio_days"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "studio_days_blocks_text" ADD CONSTRAINT "studio_days_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."studio_days"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "studio_days_blocks_gallery_images" ADD CONSTRAINT "studio_days_blocks_gallery_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "studio_days_blocks_gallery_images" ADD CONSTRAINT "studio_days_blocks_gallery_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."studio_days_blocks_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "studio_days_blocks_gallery" ADD CONSTRAINT "studio_days_blocks_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."studio_days"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "studio_days_blocks_image_text" ADD CONSTRAINT "studio_days_blocks_image_text_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "studio_days_blocks_image_text" ADD CONSTRAINT "studio_days_blocks_image_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."studio_days"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "studio_days_blocks_services_items" ADD CONSTRAINT "studio_days_blocks_services_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."studio_days_blocks_services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "studio_days_blocks_services" ADD CONSTRAINT "studio_days_blocks_services_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."studio_days"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "studio_days_blocks_call_to_action" ADD CONSTRAINT "studio_days_blocks_call_to_action_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."studio_days"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_studio_days_v_blocks_hero" ADD CONSTRAINT "_studio_days_v_blocks_hero_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_studio_days_v_blocks_hero" ADD CONSTRAINT "_studio_days_v_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_studio_days_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_studio_days_v_blocks_text" ADD CONSTRAINT "_studio_days_v_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_studio_days_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_studio_days_v_blocks_gallery_images" ADD CONSTRAINT "_studio_days_v_blocks_gallery_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_studio_days_v_blocks_gallery_images" ADD CONSTRAINT "_studio_days_v_blocks_gallery_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_studio_days_v_blocks_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_studio_days_v_blocks_gallery" ADD CONSTRAINT "_studio_days_v_blocks_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_studio_days_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_studio_days_v_blocks_image_text" ADD CONSTRAINT "_studio_days_v_blocks_image_text_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_studio_days_v_blocks_image_text" ADD CONSTRAINT "_studio_days_v_blocks_image_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_studio_days_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_studio_days_v_blocks_services_items" ADD CONSTRAINT "_studio_days_v_blocks_services_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_studio_days_v_blocks_services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_studio_days_v_blocks_services" ADD CONSTRAINT "_studio_days_v_blocks_services_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_studio_days_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_studio_days_v_blocks_call_to_action" ADD CONSTRAINT "_studio_days_v_blocks_call_to_action_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_studio_days_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_studio_days_v" ADD CONSTRAINT "_studio_days_v_parent_id_studio_days_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."studio_days"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "studio_slots" ADD CONSTRAINT "studio_slots_day_id_studio_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."studio_days"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "studio_days_blocks_hero_order_idx" ON "studio_days_blocks_hero" USING btree ("_order");
  CREATE INDEX "studio_days_blocks_hero_parent_id_idx" ON "studio_days_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "studio_days_blocks_hero_path_idx" ON "studio_days_blocks_hero" USING btree ("_path");
  CREATE INDEX "studio_days_blocks_hero_image_idx" ON "studio_days_blocks_hero" USING btree ("image_id");
  CREATE INDEX "studio_days_blocks_text_order_idx" ON "studio_days_blocks_text" USING btree ("_order");
  CREATE INDEX "studio_days_blocks_text_parent_id_idx" ON "studio_days_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "studio_days_blocks_text_path_idx" ON "studio_days_blocks_text" USING btree ("_path");
  CREATE INDEX "studio_days_blocks_gallery_images_order_idx" ON "studio_days_blocks_gallery_images" USING btree ("_order");
  CREATE INDEX "studio_days_blocks_gallery_images_parent_id_idx" ON "studio_days_blocks_gallery_images" USING btree ("_parent_id");
  CREATE INDEX "studio_days_blocks_gallery_images_image_idx" ON "studio_days_blocks_gallery_images" USING btree ("image_id");
  CREATE INDEX "studio_days_blocks_gallery_order_idx" ON "studio_days_blocks_gallery" USING btree ("_order");
  CREATE INDEX "studio_days_blocks_gallery_parent_id_idx" ON "studio_days_blocks_gallery" USING btree ("_parent_id");
  CREATE INDEX "studio_days_blocks_gallery_path_idx" ON "studio_days_blocks_gallery" USING btree ("_path");
  CREATE INDEX "studio_days_blocks_image_text_order_idx" ON "studio_days_blocks_image_text" USING btree ("_order");
  CREATE INDEX "studio_days_blocks_image_text_parent_id_idx" ON "studio_days_blocks_image_text" USING btree ("_parent_id");
  CREATE INDEX "studio_days_blocks_image_text_path_idx" ON "studio_days_blocks_image_text" USING btree ("_path");
  CREATE INDEX "studio_days_blocks_image_text_image_idx" ON "studio_days_blocks_image_text" USING btree ("image_id");
  CREATE INDEX "studio_days_blocks_services_items_order_idx" ON "studio_days_blocks_services_items" USING btree ("_order");
  CREATE INDEX "studio_days_blocks_services_items_parent_id_idx" ON "studio_days_blocks_services_items" USING btree ("_parent_id");
  CREATE INDEX "studio_days_blocks_services_order_idx" ON "studio_days_blocks_services" USING btree ("_order");
  CREATE INDEX "studio_days_blocks_services_parent_id_idx" ON "studio_days_blocks_services" USING btree ("_parent_id");
  CREATE INDEX "studio_days_blocks_services_path_idx" ON "studio_days_blocks_services" USING btree ("_path");
  CREATE INDEX "studio_days_blocks_call_to_action_order_idx" ON "studio_days_blocks_call_to_action" USING btree ("_order");
  CREATE INDEX "studio_days_blocks_call_to_action_parent_id_idx" ON "studio_days_blocks_call_to_action" USING btree ("_parent_id");
  CREATE INDEX "studio_days_blocks_call_to_action_path_idx" ON "studio_days_blocks_call_to_action" USING btree ("_path");
  CREATE UNIQUE INDEX "studio_days_slug_idx" ON "studio_days" USING btree ("slug");
  CREATE INDEX "studio_days_updated_at_idx" ON "studio_days" USING btree ("updated_at");
  CREATE INDEX "studio_days_created_at_idx" ON "studio_days" USING btree ("created_at");
  CREATE INDEX "studio_days__status_idx" ON "studio_days" USING btree ("_status");
  CREATE INDEX "_studio_days_v_blocks_hero_order_idx" ON "_studio_days_v_blocks_hero" USING btree ("_order");
  CREATE INDEX "_studio_days_v_blocks_hero_parent_id_idx" ON "_studio_days_v_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "_studio_days_v_blocks_hero_path_idx" ON "_studio_days_v_blocks_hero" USING btree ("_path");
  CREATE INDEX "_studio_days_v_blocks_hero_image_idx" ON "_studio_days_v_blocks_hero" USING btree ("image_id");
  CREATE INDEX "_studio_days_v_blocks_text_order_idx" ON "_studio_days_v_blocks_text" USING btree ("_order");
  CREATE INDEX "_studio_days_v_blocks_text_parent_id_idx" ON "_studio_days_v_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "_studio_days_v_blocks_text_path_idx" ON "_studio_days_v_blocks_text" USING btree ("_path");
  CREATE INDEX "_studio_days_v_blocks_gallery_images_order_idx" ON "_studio_days_v_blocks_gallery_images" USING btree ("_order");
  CREATE INDEX "_studio_days_v_blocks_gallery_images_parent_id_idx" ON "_studio_days_v_blocks_gallery_images" USING btree ("_parent_id");
  CREATE INDEX "_studio_days_v_blocks_gallery_images_image_idx" ON "_studio_days_v_blocks_gallery_images" USING btree ("image_id");
  CREATE INDEX "_studio_days_v_blocks_gallery_order_idx" ON "_studio_days_v_blocks_gallery" USING btree ("_order");
  CREATE INDEX "_studio_days_v_blocks_gallery_parent_id_idx" ON "_studio_days_v_blocks_gallery" USING btree ("_parent_id");
  CREATE INDEX "_studio_days_v_blocks_gallery_path_idx" ON "_studio_days_v_blocks_gallery" USING btree ("_path");
  CREATE INDEX "_studio_days_v_blocks_image_text_order_idx" ON "_studio_days_v_blocks_image_text" USING btree ("_order");
  CREATE INDEX "_studio_days_v_blocks_image_text_parent_id_idx" ON "_studio_days_v_blocks_image_text" USING btree ("_parent_id");
  CREATE INDEX "_studio_days_v_blocks_image_text_path_idx" ON "_studio_days_v_blocks_image_text" USING btree ("_path");
  CREATE INDEX "_studio_days_v_blocks_image_text_image_idx" ON "_studio_days_v_blocks_image_text" USING btree ("image_id");
  CREATE INDEX "_studio_days_v_blocks_services_items_order_idx" ON "_studio_days_v_blocks_services_items" USING btree ("_order");
  CREATE INDEX "_studio_days_v_blocks_services_items_parent_id_idx" ON "_studio_days_v_blocks_services_items" USING btree ("_parent_id");
  CREATE INDEX "_studio_days_v_blocks_services_order_idx" ON "_studio_days_v_blocks_services" USING btree ("_order");
  CREATE INDEX "_studio_days_v_blocks_services_parent_id_idx" ON "_studio_days_v_blocks_services" USING btree ("_parent_id");
  CREATE INDEX "_studio_days_v_blocks_services_path_idx" ON "_studio_days_v_blocks_services" USING btree ("_path");
  CREATE INDEX "_studio_days_v_blocks_call_to_action_order_idx" ON "_studio_days_v_blocks_call_to_action" USING btree ("_order");
  CREATE INDEX "_studio_days_v_blocks_call_to_action_parent_id_idx" ON "_studio_days_v_blocks_call_to_action" USING btree ("_parent_id");
  CREATE INDEX "_studio_days_v_blocks_call_to_action_path_idx" ON "_studio_days_v_blocks_call_to_action" USING btree ("_path");
  CREATE INDEX "_studio_days_v_parent_idx" ON "_studio_days_v" USING btree ("parent_id");
  CREATE INDEX "_studio_days_v_version_version_slug_idx" ON "_studio_days_v" USING btree ("version_slug");
  CREATE INDEX "_studio_days_v_version_version_updated_at_idx" ON "_studio_days_v" USING btree ("version_updated_at");
  CREATE INDEX "_studio_days_v_version_version_created_at_idx" ON "_studio_days_v" USING btree ("version_created_at");
  CREATE INDEX "_studio_days_v_version_version__status_idx" ON "_studio_days_v" USING btree ("version__status");
  CREATE INDEX "_studio_days_v_created_at_idx" ON "_studio_days_v" USING btree ("created_at");
  CREATE INDEX "_studio_days_v_updated_at_idx" ON "_studio_days_v" USING btree ("updated_at");
  CREATE INDEX "_studio_days_v_latest_idx" ON "_studio_days_v" USING btree ("latest");
  CREATE INDEX "studio_slots_day_idx" ON "studio_slots" USING btree ("day_id");
  CREATE UNIQUE INDEX "studio_slots_slot_key_idx" ON "studio_slots" USING btree ("slot_key");
  CREATE INDEX "studio_slots_starts_at_idx" ON "studio_slots" USING btree ("starts_at");
  CREATE INDEX "studio_slots_updated_at_idx" ON "studio_slots" USING btree ("updated_at");
  CREATE INDEX "studio_slots_created_at_idx" ON "studio_slots" USING btree ("created_at");
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_studio_day_id_studio_days_id_fk" FOREIGN KEY ("studio_day_id") REFERENCES "public"."studio_days"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_studio_slot_id_studio_slots_id_fk" FOREIGN KEY ("studio_slot_id") REFERENCES "public"."studio_slots"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_studio_days_fk" FOREIGN KEY ("studio_days_id") REFERENCES "public"."studio_days"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_studio_slots_fk" FOREIGN KEY ("studio_slots_id") REFERENCES "public"."studio_slots"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "bookings_studio_day_idx" ON "bookings" USING btree ("studio_day_id");
  CREATE INDEX "bookings_studio_slot_idx" ON "bookings" USING btree ("studio_slot_id");
  CREATE UNIQUE INDEX "bookings_studio_submission_hash_idx" ON "bookings" USING btree ("studio_submission_hash");
  CREATE INDEX "payload_locked_documents_rels_studio_days_id_idx" ON "payload_locked_documents_rels" USING btree ("studio_days_id");
  CREATE INDEX "payload_locked_documents_rels_studio_slots_id_idx" ON "payload_locked_documents_rels" USING btree ("studio_slots_id");`)
  await db.execute(sql.raw(capacityGuardUp))
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DO $$ BEGIN IF EXISTS (SELECT 1 FROM studio_days) THEN RAISE EXCEPTION 'Studio data exists; preserve and migrate it explicitly before reverting this schema'; END IF; END $$;`)
  await db.execute(sql.raw(capacityGuardDown))
  await db.execute(sql`
   ALTER TABLE "studio_days_blocks_hero" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "studio_days_blocks_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "studio_days_blocks_gallery_images" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "studio_days_blocks_gallery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "studio_days_blocks_image_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "studio_days_blocks_services_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "studio_days_blocks_services" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "studio_days_blocks_call_to_action" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "studio_days" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_studio_days_v_blocks_hero" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_studio_days_v_blocks_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_studio_days_v_blocks_gallery_images" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_studio_days_v_blocks_gallery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_studio_days_v_blocks_image_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_studio_days_v_blocks_services_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_studio_days_v_blocks_services" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_studio_days_v_blocks_call_to_action" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_studio_days_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "studio_slots" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "studio_days_blocks_hero" CASCADE;
  DROP TABLE "studio_days_blocks_text" CASCADE;
  DROP TABLE "studio_days_blocks_gallery_images" CASCADE;
  DROP TABLE "studio_days_blocks_gallery" CASCADE;
  DROP TABLE "studio_days_blocks_image_text" CASCADE;
  DROP TABLE "studio_days_blocks_services_items" CASCADE;
  DROP TABLE "studio_days_blocks_services" CASCADE;
  DROP TABLE "studio_days_blocks_call_to_action" CASCADE;
  DROP TABLE "studio_days" CASCADE;
  DROP TABLE "_studio_days_v_blocks_hero" CASCADE;
  DROP TABLE "_studio_days_v_blocks_text" CASCADE;
  DROP TABLE "_studio_days_v_blocks_gallery_images" CASCADE;
  DROP TABLE "_studio_days_v_blocks_gallery" CASCADE;
  DROP TABLE "_studio_days_v_blocks_image_text" CASCADE;
  DROP TABLE "_studio_days_v_blocks_services_items" CASCADE;
  DROP TABLE "_studio_days_v_blocks_services" CASCADE;
  DROP TABLE "_studio_days_v_blocks_call_to_action" CASCADE;
  DROP TABLE "_studio_days_v" CASCADE;
  DROP TABLE "studio_slots" CASCADE;
  ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_studio_day_id_studio_days_id_fk";
  
  ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_studio_slot_id_studio_slots_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_studio_days_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_studio_slots_fk";
  
  ALTER TABLE "bookings" ALTER COLUMN "source" SET DATA TYPE text;
  ALTER TABLE "bookings" ALTER COLUMN "source" SET DEFAULT 'staff_enquiry'::text;
  DROP TYPE "public"."enum_bookings_source";
  CREATE TYPE "public"."enum_bookings_source" AS ENUM('staff_enquiry');
  ALTER TABLE "bookings" ALTER COLUMN "source" SET DEFAULT 'staff_enquiry'::"public"."enum_bookings_source";
  ALTER TABLE "bookings" ALTER COLUMN "source" SET DATA TYPE "public"."enum_bookings_source" USING "source"::"public"."enum_bookings_source";
  ALTER TABLE "bookings" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'proposed'::text;
  DROP TYPE "public"."enum_bookings_status";
  CREATE TYPE "public"."enum_bookings_status" AS ENUM('proposed', 'confirmed', 'completed', 'cancelled');
  ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'proposed'::"public"."enum_bookings_status";
  ALTER TABLE "bookings" ALTER COLUMN "status" SET DATA TYPE "public"."enum_bookings_status" USING "status"::"public"."enum_bookings_status";
  DROP INDEX "bookings_studio_day_idx";
  DROP INDEX "bookings_studio_slot_idx";
  DROP INDEX "bookings_studio_submission_hash_idx";
  DROP INDEX "payload_locked_documents_rels_studio_days_id_idx";
  DROP INDEX "payload_locked_documents_rels_studio_slots_id_idx";
  ALTER TABLE "follow_ups" ALTER COLUMN "enquiry_id" SET NOT NULL;
  ALTER TABLE "bookings" ALTER COLUMN "enquiry_id" SET NOT NULL;
  ALTER TABLE "bookings" DROP COLUMN "studio_day_id";
  ALTER TABLE "bookings" DROP COLUMN "studio_slot_id";
  ALTER TABLE "bookings" DROP COLUMN "studio_seat";
  ALTER TABLE "bookings" DROP COLUMN "studio_revision";
  ALTER TABLE "bookings" DROP COLUMN "studio_snapshot";
  ALTER TABLE "bookings" DROP COLUMN "session_ends_at";
  ALTER TABLE "bookings" DROP COLUMN "occupied_until";
  ALTER TABLE "bookings" DROP COLUMN "studio_submission_hash";
  ALTER TABLE "bookings" DROP COLUMN "studio_content_hash";
  ALTER TABLE "bookings" DROP COLUMN "studio_message_state";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "studio_days_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "studio_slots_id";
  DROP TYPE "public"."enum_studio_days_blocks_image_text_image_side";
  DROP TYPE "public"."enum_studio_days_confirmation_mode";
  DROP TYPE "public"."enum_studio_days_day_state";
  DROP TYPE "public"."enum_studio_days_status";
  DROP TYPE "public"."enum__studio_days_v_blocks_image_text_image_side";
  DROP TYPE "public"."enum__studio_days_v_version_confirmation_mode";
  DROP TYPE "public"."enum__studio_days_v_version_day_state";
  DROP TYPE "public"."enum__studio_days_v_version_status";
  DROP TYPE "public"."enum_bookings_studio_message_state";`)
}

// Included by the schema migration and tested against concurrent PostgreSQL connections.
const capacityGuardUp = `
CREATE UNIQUE INDEX bookings_studio_active_seat ON bookings (studio_slot_id, studio_seat)
  WHERE studio_slot_id IS NOT NULL AND status NOT IN ('proposed', 'cancelled');
CREATE FUNCTION enforce_studio_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE selected_slot studio_slots%ROWTYPE;
DECLARE occupied integer;
BEGIN
  IF NEW.source::text <> 'studio_slot' THEN
    IF NEW.studio_slot_id IS NOT NULL OR NEW.studio_day_id IS NOT NULL THEN
      RAISE EXCEPTION 'Studio allocation requires studio source';
    END IF;
    IF NEW.enquiry_id IS NULL THEN RAISE EXCEPTION 'An enquiry booking requires its enquiry'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.studio_day_id IS NULL OR NEW.studio_slot_id IS NULL OR NEW.studio_seat IS NULL
     OR NEW.studio_seat <> trunc(NEW.studio_seat) OR NEW.studio_seat < 1
     OR NEW.session_at IS NULL OR NEW.session_ends_at IS NULL OR NEW.occupied_until IS NULL
     OR NEW.studio_snapshot IS NULL OR NEW.studio_revision IS NULL
     OR NEW.studio_submission_hash IS NULL OR NEW.status::text = 'proposed' THEN
    RAISE EXCEPTION 'Incomplete studio allocation';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.studio_day_id = OLD.studio_day_id AND NEW.studio_slot_id = OLD.studio_slot_id
     AND NEW.studio_seat = OLD.studio_seat AND NEW.session_at = OLD.session_at
     AND NEW.session_ends_at = OLD.session_ends_at AND NEW.occupied_until = OLD.occupied_until
     AND (NEW.status = OLD.status OR (NEW.status::text IN ('pending_approval','confirmed','completed')
       AND OLD.status::text IN ('pending_approval','confirmed','completed'))) THEN RETURN NEW; END IF;
  PERFORM id FROM studio_days WHERE id = NEW.studio_day_id FOR UPDATE;
  SELECT * INTO selected_slot FROM studio_slots WHERE id = NEW.studio_slot_id FOR UPDATE;
  IF NOT FOUND OR selected_slot.day_id <> NEW.studio_day_id OR NEW.studio_seat > selected_slot.capacity
     OR NEW.session_at <> selected_slot.starts_at OR NEW.session_ends_at <> selected_slot.ends_at
     OR NEW.occupied_until <> selected_slot.occupied_until THEN RAISE EXCEPTION 'Invalid studio allocation'; END IF;
  IF NEW.status::text = 'cancelled' THEN RETURN NEW; END IF;
  SELECT count(*) INTO occupied FROM bookings b WHERE b.id <> NEW.id
    AND b.studio_day_id = NEW.studio_day_id AND b.status::text IN ('pending_approval','confirmed','completed')
    AND b.session_at < NEW.occupied_until AND b.occupied_until > NEW.session_at;
  IF occupied >= selected_slot.capacity THEN RAISE EXCEPTION 'Studio session capacity exceeded' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bookings_studio_capacity BEFORE INSERT OR UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION enforce_studio_capacity();
`
const capacityGuardDown = `
DROP TRIGGER IF EXISTS bookings_studio_capacity ON bookings;
DROP FUNCTION IF EXISTS enforce_studio_capacity();
DROP INDEX IF EXISTS bookings_studio_active_seat;
`
