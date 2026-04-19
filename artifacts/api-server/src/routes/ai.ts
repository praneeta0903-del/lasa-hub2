import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../lib/logger";

const router = Router();

function getModel() {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GOOGLE_API_KEY not set");
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}

function parseJsonFromText(text: string): unknown {
  const cleaned = text
    .replace(/```json\n?/gi, "")
    .replace(/```\n?/g, "")
    .trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array found");
  return JSON.parse(cleaned.slice(start, end + 1));
}

router.post("/ai/analyze-image", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = req.body as {
      imageBase64: string;
      mimeType?: string;
    };

    if (!imageBase64) {
      res.status(400).json({ error: "imageBase64 required" });
      return;
    }

    const model = getModel();

    const prompt = `You are reading a handwritten grocery/shopping list.
Extract every item and its quantity from this image.
Return ONLY a valid JSON array. No markdown, no explanation, no extra text.
Format: [{"name":"Rice","quantity":"5 kg"},{"name":"Dal","quantity":"2 kg"}]
If quantity not written, use "1".
If the list is in Telugu, Hindi, or another language, translate item names to English.`;

    const result = await model.generateContent([
      { inlineData: { data: imageBase64, mimeType } },
      prompt,
    ]);

    const text = result.response.text();
    logger.info({ text }, "Gemini image response");

    const items = parseJsonFromText(text);
    res.json({ items, raw: text });
  } catch (err: any) {
    logger.error({ err: err?.message }, "AI image analysis error");
    res.status(500).json({ error: err?.message || "Image analysis failed" });
  }
});

router.post("/ai/parse-voice", async (req, res) => {
  try {
    const { transcript } = req.body as { transcript: string };

    if (!transcript?.trim()) {
      res.status(400).json({ error: "transcript required" });
      return;
    }

    const model = getModel();

    const prompt = `Parse this spoken grocery order into structured items.
Transcript: "${transcript}"
Return ONLY a valid JSON array. No markdown, no explanation, no extra text.
Format: [{"name":"Rice","quantity":"5 kg"},{"name":"Dal","quantity":"2 kg"}]
Understand quantities spoken as: "paanch kilo" = "5 kg", "do liter" = "2 L", "teen packet" = "3 packets" etc.
If the speech is in Telugu or Hindi, translate item names to English.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    logger.info({ text }, "Gemini voice response");

    const items = parseJsonFromText(text);
    res.json({ items, raw: text });
  } catch (err: any) {
    logger.error({ err: err?.message }, "AI voice parse error");
    res.status(500).json({ error: err?.message || "Voice parsing failed" });
  }
});

export default router;
