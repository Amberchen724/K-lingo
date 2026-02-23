import { db } from "./db";
import { folders, sentences, analysisCache, type Folder, type InsertFolder, type Sentence, type InsertSentence, type AnalysisCache, type SentenceAnalysis } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getFolders(): Promise<Folder[]>;
  createFolder(folder: InsertFolder): Promise<Folder>;
  updateFolder(id: number, folder: Partial<InsertFolder>): Promise<Folder>;
  deleteFolder(id: number): Promise<void>;
  getSentencesByFolder(folderId: number): Promise<Sentence[]>;
  getAllSentences(): Promise<Sentence[]>;
  createSentence(sentence: InsertSentence): Promise<Sentence>;
  deleteSentence(id: number): Promise<void>;
  getAnalysisCache(hash: string): Promise<AnalysisCache | null>;
  setAnalysisCache(hash: string, sentence: string, modelVersion: string, result: SentenceAnalysis): Promise<void>;
  updateSentenceFolderId(id: number, folderId: number): Promise<Sentence>;
}

class DatabaseStorage implements IStorage {
  async getFolders(): Promise<Folder[]> {
    return db.select().from(folders);
  }

  async createFolder(folder: InsertFolder): Promise<Folder> {
    const [created] = await db.insert(folders).values(folder).returning();
    return created;
  }

  async updateFolder(id: number, folder: Partial<InsertFolder>): Promise<Folder> {
    const [updated] = await db.update(folders).set(folder).where(eq(folders.id, id)).returning();
    return updated;
  }

  async deleteFolder(id: number): Promise<void> {
    await db.delete(folders).where(eq(folders.id, id));
  }

  async getSentencesByFolder(folderId: number): Promise<Sentence[]> {
    return db.select().from(sentences).where(eq(sentences.folderId, folderId)).orderBy(desc(sentences.createdAt));
  }

  async getAllSentences(): Promise<Sentence[]> {
    return db.select().from(sentences).orderBy(desc(sentences.createdAt));
  }

  async createSentence(sentence: InsertSentence): Promise<Sentence> {
    const [created] = await db.insert(sentences).values({
      ...sentence,
      translation: (sentence as any).translation || ""
    }).returning();
    return created;
  }

  async deleteSentence(id: number): Promise<void> {
    await db.delete(sentences).where(eq(sentences.id, id));
  }

  async getAnalysisCache(hash: string): Promise<AnalysisCache | null> {
    const [row] = await db.select().from(analysisCache).where(eq(analysisCache.hash, hash)).limit(1);
    return row ?? null;
  }

  async setAnalysisCache(hash: string, sentence: string, modelVersion: string, result: SentenceAnalysis): Promise<void> {
    await db.insert(analysisCache).values({ hash, sentence, modelVersion, result }).onConflictDoNothing();
  }

  async updateSentenceFolderId(id: number, folderId: number): Promise<Sentence> {
    const [updated] = await db.update(sentences).set({ folderId }).where(eq(sentences.id, id)).returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
