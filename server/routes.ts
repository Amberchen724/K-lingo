import type { Express } from "express";
import { createServer, type Server } from "http";
import { createHash } from "crypto";
import { storage } from "./storage";
import OpenAI from "openai";
import type { SentenceAnalysis, InsertFlashcard } from "@shared/schema";
import { registerAudioRoutes, ensureCompatibleFormat, speechToText } from "./replit_integrations/audio";
import { registerChatRoutes } from "./replit_integrations/chat";

const MODEL_VERSION = "gpt-4o-mini-v2";

function normalizeSentence(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function hashSentence(normalized: string): string {
  return createHash("sha256").update(normalized).digest("hex");
}

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerAudioRoutes(app);
  registerChatRoutes(app);

  app.post("/api/analyze", async (req, res) => {
    try {
      const { sentence } = req.body;
      if (!sentence || typeof sentence !== "string" || !sentence.trim()) {
        return res.status(400).json({ error: "Please provide a Korean sentence" });
      }

      const normalized = normalizeSentence(sentence);
      const hash = hashSentence(normalized);

      const cached = await storage.getAnalysisCache(hash);
      if (cached && cached.modelVersion === MODEL_VERSION) {
        return res.json(cached.result);
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert Korean language teacher helping a beginner learner understand Korean sentences.

Analyze the given Korean sentence and return a JSON object with exactly the following structure.

Important guidelines:
1. Break the sentence into meaningful vocabulary or grammatical units useful for learners.
2. If a verb or adjective appears in a conjugated form, identify its base dictionary form in the explanation.
3. Identify important particles and explain their role when they affect sentence meaning.
4. Focus on vocabulary that learners should study. Avoid listing obvious particles unless they are important for understanding the grammar.
5. Grammar explanations should be simple and beginner-friendly.
6. Highlight 2–4 key grammar patterns used in the sentence.
7. Use clear and natural English explanations.
8. The pronunciation should be a full romanization of the sentence.

Return JSON in this exact format:
{
  "sentence": "<the original Korean sentence>",
  "translation": "<natural English translation>",
  "pronunciation": "<full romanization of the sentence>",
  "words": [
    {  "korean": "<the form that appears in the sentence>",
      "base_form": "<dictionary form if applicable, otherwise same as korean>",
      "pronunciation": "<romanization>",
      "meaning": "<English meaning>",
      "type": "<part of speech such as Noun, Verb, Adjective, Particle, Expression>",
      "role_in_sentence": "<brief explanation of how this form functions in this sentence>",
      "other_forms": ["<common related forms the learner may encounter>"]}
  ],
  "grammar": [
    { "point": "<grammar pattern>", "explanation": "<clear explanation for beginners>", "example": "<example from the sentence>" }
  ]
}
Important rules:
1. Break the sentence into meaningful vocabulary or grammatical units useful for learners.
2. If a verb or adjective appears in a conjugated form, always include its dictionary base form.
3. For each important vocabulary item, explain its role in this sentence.
4. Include 3-5 common related forms in "other_forms" for verbs and adjectives when helpful.
5. For nouns and particles, "other_forms" can be an empty array if not applicable.
6. Focus on vocabulary that learners should study. Avoid listing trivial particles unless important for understanding the sentence.
7. Highlight 2-4 key grammar patterns used in the sentence.
8. Use simple, beginner-friendly English.

Return ONLY valid JSON.
Do not include markdown, comments, or any explanation outside the JSON.`
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

      await storage.setAnalysisCache(hash, normalized, MODEL_VERSION, analysis);

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

  app.post("/api/folders", async (req, res) => {
    try {
      const { name, emoji } = req.body;
      if (!name) return res.status(400).json({ error: "Name is required" });
      const folder = await storage.createFolder({ name, emoji: emoji || "📁" });
      res.status(201).json(folder);
    } catch (error) {
      res.status(500).json({ error: "Failed to create folder" });
    }
  });

  app.patch("/api/folders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, emoji } = req.body;
      const folder = await storage.updateFolder(id, { name, emoji });
      res.json(folder);
    } catch (error) {
      res.status(500).json({ error: "Failed to update folder" });
    }
  });

  app.delete("/api/folders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteFolder(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete folder" });
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
      const { korean, translation, pronunciation, words, grammar, folderId } = req.body;
      if (!korean || !pronunciation) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const sentence = await storage.createSentence({
        korean,
        translation,
        pronunciation,
        words,
        grammar,
        folderId: folderId || null,
      });

      const existing = await storage.getFlashcardsBySentence(sentence.id);
      if (existing.length === 0) {
        const cards: InsertFlashcard[] = [];
        cards.push({
          sentenceId: sentence.id,
          cardType: "sentence",
          frontText: (translation && translation.trim()) ? translation : korean,
          backText: korean,
          nextReviewDate: new Date(),
          reviewCount: 0,
        });
        if (words && Array.isArray(words)) {
          for (const w of words) {
            if (w.korean && w.meaning) {
              cards.push({
                sentenceId: sentence.id,
                cardType: "vocab",
                frontText: w.korean,
                backText: w.meaning,
                nextReviewDate: new Date(),
                reviewCount: 0,
              });
            }
          }
        }
        if (grammar && Array.isArray(grammar)) {
          for (const g of grammar) {
            if (g.point && g.explanation) {
              cards.push({
                sentenceId: sentence.id,
                cardType: "grammar",
                frontText: g.point,
                backText: g.explanation,
                nextReviewDate: new Date(),
                reviewCount: 0,
              });
            }
          }
        }
        await storage.createFlashcards(cards);
      }

      res.status(201).json(sentence);
    } catch (error) {
      console.error("Error saving sentence:", error);
      res.status(500).json({ error: "Failed to save sentence" });
    }
  });

  app.patch("/api/sentences/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { folderId } = req.body;
      if (!folderId || typeof folderId !== "number") {
        return res.status(400).json({ error: "folderId is required" });
      }
      const updated = await storage.updateSentenceFolderId(id, folderId);
      res.json(updated);
    } catch (error) {
      console.error("Error moving sentence:", error);
      res.status(500).json({ error: "Failed to move sentence" });
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

  app.get("/api/flashcards/due", async (_req, res) => {
    try {
      const cards = await storage.getDueFlashcards();
      res.json(cards);
    } catch (error) {
      console.error("Error fetching due flashcards:", error);
      res.status(500).json({ error: "Failed to fetch flashcards" });
    }
  });

  app.get("/api/flashcards", async (_req, res) => {
    try {
      const cards = await storage.getAllFlashcards();
      res.json(cards);
    } catch (error) {
      console.error("Error fetching flashcards:", error);
      res.status(500).json({ error: "Failed to fetch flashcards" });
    }
  });

  app.post("/api/flashcards/:id/review", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { rating } = req.body;
      if (!rating || !["again", "good", "easy"].includes(rating)) {
        return res.status(400).json({ error: "Rating must be 'again', 'good', or 'easy'" });
      }
      const now = new Date();
      let nextDate: Date;
      if (rating === "again") {
        nextDate = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
      } else if (rating === "good") {
        nextDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      } else {
        nextDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
      const updated = await storage.reviewFlashcard(id, nextDate);
      res.json(updated);
    } catch (error) {
      console.error("Error reviewing flashcard:", error);
      res.status(500).json({ error: "Failed to review flashcard" });
    }
  });

  app.post("/api/pronunciation-score", async (req, res) => {
    try {
      const { audio, sentence } = req.body;
      if (!audio || !sentence) {
        return res.status(400).json({ error: "audio and sentence are required" });
      }

      const audioBuffer = Buffer.from(audio, "base64");
      const { buffer: compatBuffer, format } = await ensureCompatibleFormat(audioBuffer);
      const transcribed = await speechToText(compatBuffer, format);

      const scoringResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a Korean pronunciation coach. You are given the original Korean sentence and the learner's transcribed speech. Compare them and return a JSON object with exactly this structure:
{
  "score": <integer 0-100 representing overall pronunciation accuracy>,
  "transcribed": "<what the learner actually said>",
  "feedback": "<1-2 sentence overall feedback in simple English>",
  "wordScores": [
    { "korean": "<word from original>", "correct": <true|false>, "note": "<brief note, e.g. 'good' or 'try pronouncing the ㅂ softer'>" }
  ]
}
Be encouraging but honest. Return ONLY valid JSON, no markdown.`
          },
          {
            role: "user",
            content: `Original sentence: ${sentence}\nLearner's speech: ${transcribed}`
          }
        ],
        temperature: 0.3,
        max_tokens: 800,
      });

      const content = scoringResponse.choices[0]?.message?.content;
      if (!content) {
        return res.status(500).json({ error: "No response from AI" });
      }

      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const result = JSON.parse(cleaned);
      res.json(result);
    } catch (error: any) {
      console.error("Pronunciation scoring error:", error);
      res.status(500).json({ error: "Failed to score pronunciation. Please try again." });
    }
  });

  return httpServer;
}
