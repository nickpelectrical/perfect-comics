import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { styleById } from "./catalog";
import { buildInkPrompt, type InkKind } from "./ink-prompt";

function key() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return null;
  return apiKey;
}

async function chat(apiKey: string, prompt: string, maxTokens: number) {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0.7,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) return { ok: false as const, error: `Writer failed (${res.status})` };
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) return { ok: false as const, error: "Empty rewrite" };
  return { ok: true as const, text };
}

async function image(input: {
  apiKey: string;
  prompt: string;
  refs?: string[];
  model?: "grok-imagine-image" | "grok-imagine-image-quality" | "grok-imagine-image-2.0";
}) {
  const refs = (input.refs ?? []).filter((r) => r.startsWith("http") || r.startsWith("data:")).slice(0, 3);
  const useEdits = refs.length > 0;
  const url = useEdits ? "https://api.x.ai/v1/images/edits" : "https://api.x.ai/v1/images/generations";
  const payload: Record<string, unknown> = {
    model: input.model ?? "grok-imagine-image",
    prompt: input.prompt.slice(0, 4000),
    n: 1,
    aspect_ratio: "3:4",
    resolution: "1k",
    response_format: "url",
  };
  if (input.model === "grok-imagine-image-2.0") payload.quality = "medium";
  if (useEdits) {
    const images = refs.map((r) => ({ url: r, type: "image_url" }));
    if (images.length === 1) payload.image = images[0];
    else payload.images = images;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${input.apiKey}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false as const, error: `Image failed (${res.status}) ${detail.slice(0, 180)}` };
  }
  const body = (await res.json()) as { data?: { url?: string; b64_json?: string }[] };
  const first = body.data?.[0];
  const imageUrl = first?.url || (first?.b64_json ? `data:image/png;base64,${first.b64_json}` : "");
  if (!imageUrl) return { ok: false as const, error: "No image returned" };
  return { ok: true as const, url: imageUrl };
}

const RewriteSchema = z.object({
  target: z.enum(["summary", "beginning", "middle", "ending", "cover", "page"]),
  title: z.string().max(80),
  genre: z.string().max(40),
  styleId: z.string().max(40),
  cast: z.string().max(800),
  current: z.string().max(2500),
  context: z.string().max(1500).optional(),
  invent: z.boolean(),
});

export const rewriteCopy = createServerFn({ method: "POST" })
  .validator((input: unknown) => RewriteSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = key();
    if (!apiKey) return { ok: false as const, error: "AI is not available" };
    const style = styleById(data.styleId);
    const prompt = `You are the copy editor for Perfect Comics. Return ONLY the rewritten text, no JSON, no quotes.
Target box: ${data.target}
Title: ${data.title || "Untitled"}
Genre: ${data.genre}
Art style: ${style.label}
Cast: ${data.cast || "original lead"}
Context: ${data.context || "(none)"}
Current text: ${data.current || "(empty)"}
${data.invent ? "Invent a vivid all-ages beat that fits genre and cast. 60–140 words." : "Keep their intent. Sharpen visuals. Do not change the story's direction. 60–140 words."}
All-ages. No gore.`;
    return chat(apiKey, prompt, 500);
  });

const PageSchema = z.object({
  kind: z.enum(["cover", "interior", "small", "rewrite"]),
  page: z.number().int().min(0).max(9),
  title: z.string().max(80),
  styleId: z.string().max(40),
  beat: z.string().max(2000),
  cast: z.string().max(800),
  note: z.string().max(400).optional(),
  actSummary: z.string().max(1500).optional(),
  hasPrevPage: z.boolean().optional(),
  refs: z.array(z.string().max(2_000_000)).max(5).optional(),
  model: z.enum(["grok-imagine-image", "grok-imagine-image-quality", "grok-imagine-image-2.0"]).optional(),
});

export const inkPage = createServerFn({ method: "POST" })
  .validator((input: unknown) => PageSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = key();
    if (!apiKey) return { ok: false as const, error: "AI is not available" };
    const prompt = buildInkPrompt({
      kind: (data.kind === "small" ? "small" : data.kind === "cover" ? "cover" : "interior") as InkKind,
      page: data.page,
      title: data.title,
      styleId: data.styleId,
      beat: data.beat,
      cast: data.cast,
      note: data.note,
      actSummary: data.actSummary,
      hasPrevPage: Boolean(data.hasPrevPage),
    });
    const refs = (data.refs ?? []).slice(0, 3);
    return image({ apiKey, prompt, refs, model: data.model });
  });

const PlanSchema = z.object({
  title: z.string().max(80),
  genre: z.string().max(40),
  cast: z.string().max(800),
  summary: z.string().max(2500),
  beginning: z.string().max(1500),
  middle: z.string().max(1500),
  ending: z.string().max(1500),
});

export const planBeats = createServerFn({ method: "POST" })
  .validator((input: unknown) => PlanSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = key();
    if (!apiKey) return { ok: false as const, error: "AI is not available" };
    const prompt = `You break one comic issue into ten visual beats for an image generator.
Return ONLY JSON: {"beats":["...","..."]} with exactly 10 strings.
Index 0 is the COVER: one splash, no panels.
Indexes 1-3 are the beginning, 4-6 the middle, 7-9 the ending.
Each string is 1 or 2 sentences of what we SEE on that page. A new moment every page. Do not repeat a scene.
No dialogue to letter. All-ages. No gore.
Title: ${data.title || "My Percfect Hero"}
Genre: ${data.genre}
Cast: ${data.cast || "original lead"}
Issue summary: ${data.summary || "(none)"}
Beginning summary: ${data.beginning || "(use the issue summary)"}
Middle summary: ${data.middle || "(use the issue summary)"}
Ending summary: ${data.ending || "(use the issue summary)"}`;
    const result = await chat(apiKey, prompt, 900);
    if (!result.ok) return result;
    const match = result.text.match(/\{[\s\S]*\}/);
    if (!match) return { ok: false as const, error: "Could not plan the pages" };
    try {
      const parsed = JSON.parse(match[0]) as { beats?: unknown };
      const beats = Array.isArray(parsed.beats) ? parsed.beats.filter((b): b is string => typeof b === "string" && b.trim().length > 0) : [];
      if (beats.length < 4) return { ok: false as const, error: "The page plan was too short" };
      return { ok: true as const, beats: beats.slice(0, 10) };
    } catch {
      return { ok: false as const, error: "Could not plan the pages" };
    }
  });
