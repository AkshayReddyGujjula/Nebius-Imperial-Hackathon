import { CONFIG } from "../config";

const KEYTERMS = ["Nebius", "Token Factory", "Tavily", "DeepSeek", "hackathon", "Imperial", "machine learning", "open models", "OpenAI", "startup"];

export async function transcribe(file: File | Blob): Promise<{ text: string; ms: number }> {
  const t0 = Date.now();
  const send = async (withKeyterms: boolean) => {
    const fd = new FormData();
    fd.append("model_id", "scribe_v2");
    fd.append("file", file, "speech.webm");
    fd.append("language_code", "en");
    fd.append("tag_audio_events", "false");
    if (withKeyterms) for (const k of KEYTERMS) fd.append("keyterms", k);
    return fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST", headers: { "xi-api-key": CONFIG.keys.elevenlabs }, body: fd, signal: AbortSignal.timeout(30_000) });
  };
  let r = await send(true);
  if (r.status >= 400 && r.status < 500) r = await send(false);   // Smoke accepted keyterms; retain the plain fallback for compatibility.
  if (!r.ok) throw new Error(`Transcription failed (${r.status})`);
  const j: any = await r.json();
  return { text: String(j.text ?? "").trim(), ms: Date.now() - t0 };
}
