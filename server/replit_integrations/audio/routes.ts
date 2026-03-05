import type { Express, Request, Response } from "express";
import { textToSpeech } from "./client";

export function registerAudioRoutes(app: Express): void {
  app.post("/api/tts", async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const audioBuffer = await textToSpeech(text, "shimmer", "wav");
      
      res.setHeader("Content-Type", "audio/wav");
      res.send(audioBuffer);
    } catch (error) {
      console.error("TTS error:", error);
      res.status(500).json({ error: "Failed to generate speech" });
    }
  });
}
