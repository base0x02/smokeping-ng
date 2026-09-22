CREATE TABLE IF NOT EXISTS "groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"parent_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "measurements" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"target_id" integer NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"sent" integer NOT NULL,
	"received" integer NOT NULL,
	"avg_rtt_ms" real,
	"stddev_rtt_ms" real,
	"loss_pct" real NOT NULL,
	"raw_rtts" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"host" text NOT NULL,
	"group_id" integer,
	"enabled" boolean DEFAULT true NOT NULL,
	"ping_count" integer DEFAULT 20 NOT NULL,
	"interval_seconds" integer DEFAULT 300 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "measurements_target_ts_idx" ON "measurements" USING btree ("target_id","ts");