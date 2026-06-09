import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export interface UserPrefsPayload {
  minimapVisible: boolean;
  tagsVisible: boolean;
}

export const userPreferencesTable = pgTable("user_preferences", {
  userId: text("user_id").primaryKey(),
  preferences: jsonb("preferences").notNull().$type<UserPrefsPayload>(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserPreferences = typeof userPreferencesTable.$inferSelect;
export type InsertUserPreferences = typeof userPreferencesTable.$inferInsert;
