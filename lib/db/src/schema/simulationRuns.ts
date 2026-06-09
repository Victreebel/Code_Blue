import { pgTable, text, integer, jsonb, timestamp, uuid } from "drizzle-orm/pg-core";

export interface SimulationRunScoreData {
  total: number;
  buckets: Array<{
    id: string;
    label: string;
    max: number;
    awarded: number;
    arithmetic: string;
    reasons: string[];
  }>;
  strengths: string[];
  misses: string[];
  teachingPoints: string[];
}

export const simulationRunsTable = pgTable("simulation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  scenario: text("scenario").notNull(),
  seed: text("seed"),
  outcome: text("outcome"),
  score: integer("score"),
  durationSeconds: integer("duration_seconds"),
  scoreData: jsonb("score_data").$type<SimulationRunScoreData>(),
  runAt: timestamp("run_at").defaultNow().notNull(),
});

export type SimulationRun = typeof simulationRunsTable.$inferSelect;
export type InsertSimulationRun = typeof simulationRunsTable.$inferInsert;
