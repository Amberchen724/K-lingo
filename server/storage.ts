import { db } from "./db";
import { folders, sentences, analysisCache, flashcards, type Folder, type InsertFolder, type Sentence, type InsertSentence, type AnalysisCache, type SentenceAnalysis, type Flashcard, type InsertFlashcard } from "@shared/schema";
import { eq, desc, lte, sql } from "drizzle-orm";

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
  getFlashcardsBySentence(sentenceId: number): Promise<Flashcard[]>;
  createFlashcards(cards: InsertFlashcard[]): Promise<Flashcard[]>;
  getDueFlashcards(): Promise<Flashcard[]>;
  reviewFlashcard(id: number, nextReviewDate: Date): Promise<Flashcard>;
  getAllFlashcards(): Promise<Flashcard[]>;
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

  async getFlashcardsBySentence(sentenceId: number): Promise<Flashcard[]> {
    return db.select().from(flashcards).where(eq(flashcards.sentenceId, sentenceId));
  }

  async createFlashcards(cards: InsertFlashcard[]): Promise<Flashcard[]> {
    if (cards.length === 0) return [];
    return db.insert(flashcards).values(cards).returning();
  }

  async getDueFlashcards(): Promise<Flashcard[]> {
    const now = new Date();
    return db.select().from(flashcards).where(lte(flashcards.nextReviewDate, now)).orderBy(flashcards.nextReviewDate);
  }

  async reviewFlashcard(id: number, nextReviewDate: Date): Promise<Flashcard> {
    const [updated] = await db
      .update(flashcards)
      .set({ nextReviewDate, reviewCount: sql`${flashcards.reviewCount} + 1` })
      .where(eq(flashcards.id, id))
      .returning();
    return updated;
  }

  async getAllFlashcards(): Promise<Flashcard[]> {
    return db.select().from(flashcards).orderBy(desc(flashcards.createdAt));
  }
}

export const storage = new DatabaseStorage();
