import { db } from "./db";
import { folders, sentences, type Folder, type InsertFolder, type Sentence, type InsertSentence } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getFolders(): Promise<Folder[]>;
  createFolder(folder: InsertFolder): Promise<Folder>;
  getSentencesByFolder(folderId: number): Promise<Sentence[]>;
  getAllSentences(): Promise<Sentence[]>;
  createSentence(sentence: InsertSentence): Promise<Sentence>;
  deleteSentence(id: number): Promise<void>;
}

class DatabaseStorage implements IStorage {
  async getFolders(): Promise<Folder[]> {
    return db.select().from(folders);
  }

  async createFolder(folder: InsertFolder): Promise<Folder> {
    const [created] = await db.insert(folders).values(folder).returning();
    return created;
  }

  async getSentencesByFolder(folderId: number): Promise<Sentence[]> {
    return db.select().from(sentences).where(eq(sentences.folderId, folderId)).orderBy(desc(sentences.createdAt));
  }

  async getAllSentences(): Promise<Sentence[]> {
    return db.select().from(sentences).orderBy(desc(sentences.createdAt));
  }

  async createSentence(sentence: InsertSentence): Promise<Sentence> {
    const [created] = await db.insert(sentences).values(sentence).returning();
    return created;
  }

  async deleteSentence(id: number): Promise<void> {
    await db.delete(sentences).where(eq(sentences.id, id));
  }
}

export const storage = new DatabaseStorage();
