import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_bookings_source" AS ENUM('staff_enquiry');
  CREATE TYPE "public"."enum_bookings_status" AS ENUM('proposed', 'confirmed', 'completed', 'cancelled');
  CREATE TYPE "public"."enum_revenue_entries_kind" AS ENUM('payment', 'refund', 'reversal');
  CREATE TYPE "public"."enum_customer_activities_source" AS ENUM('website', 'staff', 'provider', 'migration', 'system');
  CREATE TYPE "public"."enum_email_templates_kind" AS ENUM('enquiry', 'booking', 'follow_up');
  CREATE TYPE "public"."enum_email_messages_kind" AS ENUM('customer_draft', 'sandbox_test', 'photographer_notification');
  CREATE TYPE "public"."enum_email_messages_status" AS ENUM('draft', 'queued', 'sending', 'accepted', 'delayed', 'delivered', 'bounced', 'failed', 'uncertain', 'manual', 'disabled');
  CREATE TABLE "contacts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"phone" varchar,
  	"notes" varchar,
  	"source_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "bookings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"contact_id" integer NOT NULL,
  	"enquiry_id" integer NOT NULL,
  	"source" "enum_bookings_source" DEFAULT 'staff_enquiry' NOT NULL,
  	"status" "enum_bookings_status" DEFAULT 'proposed' NOT NULL,
  	"session_at" timestamp(3) with time zone,
  	"expected_minor" numeric NOT NULL,
  	"currency" varchar NOT NULL,
  	"attribution" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "revenue_entries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"booking_id" integer NOT NULL,
  	"contact_id" integer NOT NULL,
  	"kind" "enum_revenue_entries_kind" NOT NULL,
  	"amount_minor" numeric NOT NULL,
  	"currency" varchar NOT NULL,
  	"reverses_id" integer,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"reason" varchar NOT NULL,
  	"actor_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "customer_activities" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"contact_id" integer NOT NULL,
  	"enquiry_id" integer,
  	"booking_id" integer,
  	"email_message_id" integer,
  	"actor_id" integer,
  	"kind" varchar NOT NULL,
  	"summary" varchar NOT NULL,
  	"source" "enum_customer_activities_source" NOT NULL,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"details" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "email_templates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"kind" "enum_email_templates_kind" NOT NULL,
  	"subject" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"approved" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "email_messages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"contact_id" integer NOT NULL,
  	"enquiry_id" integer,
  	"booking_id" integer,
  	"template_id" integer,
  	"kind" "enum_email_messages_kind" NOT NULL,
  	"status" "enum_email_messages_status" DEFAULT 'draft' NOT NULL,
  	"subject" varchar NOT NULL,
  	"text" varchar NOT NULL,
  	"html" varchar NOT NULL,
  	"variables" jsonb NOT NULL,
  	"template_snapshot" jsonb NOT NULL,
  	"recipient" varchar NOT NULL,
  	"sender" varchar,
  	"provider_payload" jsonb,
  	"idempotency_key" varchar,
  	"notification_key" varchar,
  	"provider_id" varchar,
  	"attempts" numeric DEFAULT 0 NOT NULL,
  	"first_attempt_at" timestamp(3) with time zone,
  	"last_attempt_at" timestamp(3) with time zone,
  	"accepted_at" timestamp(3) with time zone,
  	"delivered_at" timestamp(3) with time zone,
  	"failure_code" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "enquiries" ADD COLUMN "contact_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "contacts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "bookings_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "revenue_entries_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "customer_activities_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "email_templates_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "email_messages_id" integer;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "revenue_entries" ADD CONSTRAINT "revenue_entries_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "revenue_entries" ADD CONSTRAINT "revenue_entries_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "revenue_entries" ADD CONSTRAINT "revenue_entries_reverses_id_revenue_entries_id_fk" FOREIGN KEY ("reverses_id") REFERENCES "public"."revenue_entries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "revenue_entries" ADD CONSTRAINT "revenue_entries_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customer_activities" ADD CONSTRAINT "customer_activities_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customer_activities" ADD CONSTRAINT "customer_activities_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customer_activities" ADD CONSTRAINT "customer_activities_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customer_activities" ADD CONSTRAINT "customer_activities_email_message_id_email_messages_id_fk" FOREIGN KEY ("email_message_id") REFERENCES "public"."email_messages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customer_activities" ADD CONSTRAINT "customer_activities_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "contacts_email_idx" ON "contacts" USING btree ("email");
  CREATE UNIQUE INDEX "contacts_source_key_idx" ON "contacts" USING btree ("source_key");
  CREATE INDEX "contacts_updated_at_idx" ON "contacts" USING btree ("updated_at");
  CREATE INDEX "contacts_created_at_idx" ON "contacts" USING btree ("created_at");
  CREATE INDEX "bookings_contact_idx" ON "bookings" USING btree ("contact_id");
  CREATE INDEX "bookings_enquiry_idx" ON "bookings" USING btree ("enquiry_id");
  CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");
  CREATE INDEX "bookings_session_at_idx" ON "bookings" USING btree ("session_at");
  CREATE INDEX "bookings_updated_at_idx" ON "bookings" USING btree ("updated_at");
  CREATE INDEX "bookings_created_at_idx" ON "bookings" USING btree ("created_at");
  CREATE INDEX "revenue_entries_booking_idx" ON "revenue_entries" USING btree ("booking_id");
  CREATE INDEX "revenue_entries_contact_idx" ON "revenue_entries" USING btree ("contact_id");
  CREATE UNIQUE INDEX "revenue_entries_reverses_idx" ON "revenue_entries" USING btree ("reverses_id");
  CREATE INDEX "revenue_entries_actor_idx" ON "revenue_entries" USING btree ("actor_id");
  CREATE INDEX "revenue_entries_updated_at_idx" ON "revenue_entries" USING btree ("updated_at");
  CREATE INDEX "revenue_entries_created_at_idx" ON "revenue_entries" USING btree ("created_at");
  CREATE INDEX "customer_activities_contact_idx" ON "customer_activities" USING btree ("contact_id");
  CREATE INDEX "customer_activities_enquiry_idx" ON "customer_activities" USING btree ("enquiry_id");
  CREATE INDEX "customer_activities_booking_idx" ON "customer_activities" USING btree ("booking_id");
  CREATE INDEX "customer_activities_email_message_idx" ON "customer_activities" USING btree ("email_message_id");
  CREATE INDEX "customer_activities_actor_idx" ON "customer_activities" USING btree ("actor_id");
  CREATE INDEX "customer_activities_kind_idx" ON "customer_activities" USING btree ("kind");
  CREATE INDEX "customer_activities_occurred_at_idx" ON "customer_activities" USING btree ("occurred_at");
  CREATE INDEX "customer_activities_updated_at_idx" ON "customer_activities" USING btree ("updated_at");
  CREATE INDEX "customer_activities_created_at_idx" ON "customer_activities" USING btree ("created_at");
  CREATE INDEX "email_templates_updated_at_idx" ON "email_templates" USING btree ("updated_at");
  CREATE INDEX "email_templates_created_at_idx" ON "email_templates" USING btree ("created_at");
  CREATE INDEX "email_messages_contact_idx" ON "email_messages" USING btree ("contact_id");
  CREATE INDEX "email_messages_enquiry_idx" ON "email_messages" USING btree ("enquiry_id");
  CREATE INDEX "email_messages_booking_idx" ON "email_messages" USING btree ("booking_id");
  CREATE INDEX "email_messages_template_idx" ON "email_messages" USING btree ("template_id");
  CREATE INDEX "email_messages_status_idx" ON "email_messages" USING btree ("status");
  CREATE UNIQUE INDEX "email_messages_idempotency_key_idx" ON "email_messages" USING btree ("idempotency_key");
  CREATE UNIQUE INDEX "email_messages_notification_key_idx" ON "email_messages" USING btree ("notification_key");
  CREATE UNIQUE INDEX "email_messages_provider_id_idx" ON "email_messages" USING btree ("provider_id");
  CREATE INDEX "email_messages_updated_at_idx" ON "email_messages" USING btree ("updated_at");
  CREATE INDEX "email_messages_created_at_idx" ON "email_messages" USING btree ("created_at");
  ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_contacts_fk" FOREIGN KEY ("contacts_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bookings_fk" FOREIGN KEY ("bookings_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_revenue_entries_fk" FOREIGN KEY ("revenue_entries_id") REFERENCES "public"."revenue_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customer_activities_fk" FOREIGN KEY ("customer_activities_id") REFERENCES "public"."customer_activities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_email_templates_fk" FOREIGN KEY ("email_templates_id") REFERENCES "public"."email_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_email_messages_fk" FOREIGN KEY ("email_messages_id") REFERENCES "public"."email_messages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "enquiries_contact_idx" ON "enquiries" USING btree ("contact_id");
  CREATE INDEX "payload_locked_documents_rels_contacts_id_idx" ON "payload_locked_documents_rels" USING btree ("contacts_id");
  CREATE INDEX "payload_locked_documents_rels_bookings_id_idx" ON "payload_locked_documents_rels" USING btree ("bookings_id");
  CREATE INDEX "payload_locked_documents_rels_revenue_entries_id_idx" ON "payload_locked_documents_rels" USING btree ("revenue_entries_id");
  CREATE INDEX "payload_locked_documents_rels_customer_activities_id_idx" ON "payload_locked_documents_rels" USING btree ("customer_activities_id");
  CREATE INDEX "payload_locked_documents_rels_email_templates_id_idx" ON "payload_locked_documents_rels" USING btree ("email_templates_id");
  CREATE INDEX "payload_locked_documents_rels_email_messages_id_idx" ON "payload_locked_documents_rels" USING btree ("email_messages_id");`)
  // Additive operational tables are deliberately outside Payload's editor API.
  await db.execute(sql`
    CREATE TABLE customer_operations (
      operation_key varchar PRIMARY KEY,
      input_hash varchar NOT NULL,
      result jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE email_delivery_events (
      event_id varchar PRIMARY KEY,
      message_id integer NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
      provider_id varchar NOT NULL,
      kind varchar NOT NULL,
      occurred_at timestamptz NOT NULL,
      received_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX email_delivery_events_message_idx ON email_delivery_events(message_id);

    INSERT INTO contacts (name, email, source_key, created_at, updated_at)
      SELECT name, email, 'legacy-enquiry:' || id, created_at, created_at FROM enquiries
      WHERE contact_id IS NULL;
    UPDATE enquiries e SET contact_id = c.id FROM contacts c
      WHERE c.source_key = 'legacy-enquiry:' || e.id AND e.contact_id IS NULL;
    INSERT INTO customer_activities (contact_id, enquiry_id, kind, summary, source, occurred_at, details)
      SELECT contact_id, id, 'enquiry_received', 'Existing enquiry linked during migration', 'migration', created_at,
        jsonb_build_object('originalFollowUp', follow_up, 'historicalSnapshot', true) FROM enquiries;
    INSERT INTO customer_activities (contact_id, enquiry_id, kind, summary, source, occurred_at, details)
      SELECT contact_id, id, 'legacy_notification', 'Historical notification: ' || notification_status, 'migration',
        coalesce(notification_attempted_at, created_at),
        jsonb_build_object('status', notification_status, 'attempts', notification_attempts,
          'contentCaptured', false, 'providerIdCaptured', false, 'timeKnown', notification_attempted_at IS NOT NULL)
      FROM enquiries;
    INSERT INTO email_templates (name, kind, subject, body, approved) VALUES
      ('Example enquiry — review before use', 'enquiry', 'Your {{service_title}} enquiry',
        'Hello {{contact_name}}, thank you for your enquiry about {{service_title}}. Example wording only; review before use.', false),
      ('Example booking — review before use', 'booking', '{{service_title}}: {{booking_status}}',
        'Hello {{contact_name}}, your session record is {{booking_status}}. Session: {{session_time}}. Expected value: {{expected_value}}. Example wording only; review before use.', false),
      ('Example follow-up — review before use', 'follow_up', 'Following up on {{service_title}}',
        'Hello {{contact_name}}, this is example follow-up wording about {{service_title}}. Review before use. No scheduled delivery is configured.', false);
  `)

}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error('Customer history cannot be safely rolled back by dropping records. Restore an approved database backup or write a forward correction migration.')
}
