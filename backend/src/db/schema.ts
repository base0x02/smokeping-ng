import {
  pgTable,
  serial,
  bigserial,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  parentId: integer("parent_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groupsRelations = relations(groups, ({ one, many }) => ({
  parent: one(groups, { fields: [groups.parentId], references: [groups.id] }),
  targets: many(targets),
}));

export const targets = pgTable("targets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  host: text("host").notNull(),
  groupId: integer("group_id"),
  enabled: boolean("enabled").notNull().default(true),
  pingCount: integer("ping_count").notNull().default(20),
  intervalSeconds: integer("interval_seconds").notNull().default(300),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const targetsRelations = relations(targets, ({ one, many }) => ({
  group: one(groups, { fields: [targets.groupId], references: [groups.id] }),
  measurements: many(measurements),
}));

export const measurements = pgTable(
  "measurements",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    targetId: integer("target_id").notNull(),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    sent: integer("sent").notNull(),
    received: integer("received").notNull(),
    avgRttMs: real("avg_rtt_ms"),
    stddevRttMs: real("stddev_rtt_ms"),
    lossPct: real("loss_pct").notNull(),
    rawRtts: jsonb("raw_rtts").$type<(number | null)[]>(),
  },
  (table) => ({
    targetTsIdx: index("measurements_target_ts_idx").on(table.targetId, table.ts),
  }),
);

export const measurementsRelations = relations(measurements, ({ one }) => ({
  target: one(targets, { fields: [measurements.targetId], references: [targets.id] }),
}));
