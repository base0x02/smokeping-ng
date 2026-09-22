-- Drop exact (target_id, ts) duplicates, keeping the earliest row, so the unique index can be built.
DELETE FROM "measurements" a USING "measurements" b WHERE a."target_id" = b."target_id" AND a."ts" = b."ts" AND a."id" > b."id";--> statement-breakpoint
DROP INDEX IF EXISTS "measurements_target_ts_idx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "measurements_target_ts_uniq" ON "measurements" USING btree ("target_id","ts");
