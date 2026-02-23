import { sql } from "drizzle-orm";
import { pgTable, serial, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const folders = pgTable("folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default(""),
});

export const sentences = pgTable("sentences", {
  id: serial("id").primaryKey(),
  korean: text("korean").notNull(),
  pronunciation: text("pronunciation").notNull(),
  words: jsonb("words").notNull().$type<WordEntry[]>(),
  grammar: jsonb("grammar").notNull().$type<GrammarEntry[]>(),
  folderId: integer("folder_id").references(() => folders.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export interface WordEntry {
  korean: string;
  meaning: string;
  type: string;
}

export interface GrammarEntry {
  point: string;
  explanation: string;
  example: string;
}

export interface SentenceAnalysis {
  sentence: string;
  translation: string;
  pronunciation: string;
  words: WordEntry[];
  grammar: GrammarEntry[];
}

export const insertFolderSchema = createInsertSchema(folders).omit({ id: true });
export const insertSentenceSchema = createInsertSchema(sentences).omit({ id: true, createdAt: true });

export type Folder = typeof folders.$inferSelect;
export type InsertFolder = z.infer<typeof insertFolderSchema>;
export type Sentence = typeof sentences.$inferSelect;
export type InsertSentence = z.infer<typeof insertSentenceSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
