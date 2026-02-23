import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";
import type { SentenceAnalysis } from "@shared/schema";
import { registerAudioRoutes } from "./replit_integrations/audio";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerAudioRoutes(app);

  app.post("/api/analyze", async (req, res) => {
    try {
      const { sentence } = req.body;
      if (!sentence || typeof sentence !== "string" || !sentence.trim()) {
        return res.status(400).json({ error: "Please provide a Korean sentence" });
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a Korean language expert. Analyze the given Korean sentence and return a JSON object with exactly this structure:
{
  "sentence": "<the original Korean sentence>",
  "translation": "<natural English translation>",
  "pronunciation": "<full romanization of the sentence>",
  "words": [
    { "korean": "<Korean word or morpheme>", "meaning": "<English meaning>", "type": "<part of speech: Noun, Verb, Adjective, Adverb, Particle, Greeting, Pronoun, Conjunction, etc.>" }
  ],
  "grammar": [
    { "point": "<grammar pattern>", "explanation": "<clear explanation for beginners>", "example": "<example from the sentence>" }
  ]
}
Break down ALL words and particles. Identify 2-4 key grammar points. Use simple, beginner-friendly explanations. Return ONLY valid JSON, no markdown.`
          },
          {
            role: "user",
            content: sentence.trim()
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return res.status(500).json({ error: "No response from AI" });
      }

      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const analysis: SentenceAnalysis = JSON.parse(cleaned);
      res.json(analysis);
    } catch (error: any) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: "Failed to analyze sentence. Please try again." });
    }
  });

  app.get("/api/folders", async (_req, res) => {
    try {
      const allFolders = await storage.getFolders();
      res.json(allFolders);
    } catch (error) {
      console.error("Error fetching folders:", error);
      res.status(500).json({ error: "Failed to fetch folders" });
    }
  });

  app.get("/api/folders/:id/sentences", async (req, res) => {
    try {
      const folderId = parseInt(req.params.id);
      const results = await storage.getSentencesByFolder(folderId);
      res.json(results);
    } catch (error) {
      console.error("Error fetching sentences:", error);
      res.status(500).json({ error: "Failed to fetch sentences" });
    }
  });

  app.post("/api/sentences", async (req, res) => {
    try {
      const { korean, pronunciation, words, grammar, folderId } = req.body;
      if (!korean || !pronunciation) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const sentence = await storage.createSentence({
        korean,
        pronunciation,
        words,
        grammar,
        folderId: folderId || null,
      });
      res.status(201).json(sentence);
    } catch (error) {
      console.error("Error saving sentence:", error);
      res.status(500).json({ error: "Failed to save sentence" });
    }
  });

  app.delete("/api/sentences/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSentence(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting sentence:", error);
      res.status(500).json({ error: "Failed to delete sentence" });
    }
  });

  return httpServer;
}
