// OpenRouter calls for the native agents. Cheap models only; the key has a hard spend limit.
const URL = "https://openrouter.ai/api/v1/chat/completions";
const TEXT = () => process.env.NATIVE_TEXT_MODEL ?? "google/gemini-2.5-flash-lite";
const IMAGE = () => process.env.NATIVE_IMAGE_MODEL ?? "google/gemini-2.5-flash-image";

async function call(body: Record<string, unknown>) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY missing");
  const r = await fetch(URL, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "HTTP-Referer": "https://arctisans.vercel.app", "X-Title": "Arctisans" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`model ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()) as { choices: { message: { content?: string; images?: { image_url: { url: string } }[] } }[] };
}

export async function chat(system: string, user: string, max = 700): Promise<string> {
  const j = await call({ model: TEXT(), max_tokens: max, messages: [{ role: "system", content: system }, { role: "user", content: user }] });
  const t = (j.choices[0]?.message.content ?? "").trim();
  if (!t) throw new Error("empty model reply");
  return t;
}

/** Returns PNG/JPEG bytes. */
export async function image(prompt: string): Promise<{ buf: Buffer; type: string }> {
  const j = await call({ model: IMAGE(), modalities: ["image", "text"], messages: [{ role: "user", content: prompt }] });
  const url = j.choices[0]?.message.images?.[0]?.image_url.url ?? "";
  const m = url.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m) throw new Error("no image returned");
  return { buf: Buffer.from(m[2], "base64"), type: m[1] };
}
