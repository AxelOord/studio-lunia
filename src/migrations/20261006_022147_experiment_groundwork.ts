import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_experiments_mode" AS ENUM('simulation', 'live');
  CREATE TYPE "public"."enum_experiments_state" AS ENUM('draft', 'ready', 'stopped');
  CREATE TABLE "experiments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"hypothesis" varchar NOT NULL,
  	"page_id" integer NOT NULL,
  	"mode" "enum_experiments_mode" DEFAULT 'simulation' NOT NULL,
  	"state" "enum_experiments_state" DEFAULT 'draft' NOT NULL,
  	"control_label" varchar,
  	"treatment_label" varchar NOT NULL,
  	"treatment_percent" numeric DEFAULT 50 NOT NULL,
  	"baseline" varchar,
  	"traffic_plan" varchar,
  	"minimum_per_variant" numeric DEFAULT 1000 NOT NULL,
  	"duration_days" numeric DEFAULT 14 NOT NULL,
  	"service" varchar,
  	"prepared_at" timestamp(3) with time zone,
  	"stopped_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "pages" ADD COLUMN "inquiry_button_label" varchar;
  ALTER TABLE "_pages_v" ADD COLUMN "version_inquiry_button_label" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "experiments_id" integer;
  ALTER TABLE "experiments" ADD CONSTRAINT "experiments_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "experiments_one_live_page" ON experiments (page_id) WHERE mode='live' AND state='ready';
  CREATE TABLE lunia_experiment_visitors (
    key text PRIMARY KEY, expires_at timestamptz NOT NULL, revoked boolean NOT NULL DEFAULT false
  );
  CREATE TABLE lunia_experiment_enrollments (
    experiment_id integer NOT NULL REFERENCES experiments(id) ON DELETE RESTRICT,
    visitor_key text NOT NULL REFERENCES lunia_experiment_visitors(key) ON DELETE RESTRICT,
    variant text NOT NULL CHECK (variant IN ('control','treatment')),
    assigned_at timestamptz NOT NULL DEFAULT now(), exposed_at timestamptz, converted_at timestamptz,
    PRIMARY KEY (experiment_id,visitor_key),
    CHECK (converted_at IS NULL OR (exposed_at IS NOT NULL AND converted_at >= exposed_at))
  );
  CREATE INDEX lunia_experiment_visitor_idx ON lunia_experiment_enrollments(visitor_key);
  CREATE INDEX "experiments_page_idx" ON "experiments" USING btree ("page_id");
  CREATE INDEX "experiments_updated_at_idx" ON "experiments" USING btree ("updated_at");
  CREATE INDEX "experiments_created_at_idx" ON "experiments" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_experiments_fk" FOREIGN KEY ("experiments_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_experiments_id_idx" ON "payload_locked_documents_rels" USING btree ("experiments_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Never silently discard experiment plans or results on rollback.
  const existing = await db.execute(sql`SELECT id FROM experiments LIMIT 1`)
  if (existing.rows.length) throw new Error('Experiment records exist; export and review before rollback.')
  await db.execute(sql`
   DROP TABLE lunia_experiment_enrollments;
   DROP TABLE lunia_experiment_visitors;
   ALTER TABLE "experiments" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "experiments" CASCADE;

  
  DROP INDEX "payload_locked_documents_rels_experiments_id_idx";
  ALTER TABLE "pages" DROP COLUMN "inquiry_button_label";
  ALTER TABLE "_pages_v" DROP COLUMN "version_inquiry_button_label";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "experiments_id";
  DROP TYPE "public"."enum_experiments_mode";
  DROP TYPE "public"."enum_experiments_state";`)
}
