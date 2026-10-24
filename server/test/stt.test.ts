import { afterEach, describe, expect, it, vi } from "vitest";
import { transcribe } from "../src/stt/elevenlabs";

afterEach(() => vi.unstubAllGlobals());

describe("ElevenLabs transcription", () => {
  it("sends Scribe v2 English audio with repeated keyterms and trims the transcript", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ text: "  Attend the hackathon.  " }));
    vi.stubGlobal("fetch", fetch);
    const file = new Blob(["audio"], { type: "audio/webm" });

    const result = await transcribe(file);

    expect(result.text).toBe("Attend the hackathon.");
    expect(result.ms).toBeGreaterThanOrEqual(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, request] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.elevenlabs.io/v1/speech-to-text");
    expect(request.method).toBe("POST");
    expect(request.signal).toBeInstanceOf(AbortSignal);
    const form = request.body as FormData;
    expect(form.get("model_id")).toBe("scribe_v2");
    expect(form.get("language_code")).toBe("en");
    expect(form.get("tag_audio_events")).toBe("false");
    expect(form.getAll("keyterms")).toEqual([
      "Nebius", "Token Factory", "Tavily", "DeepSeek", "hackathon", "Imperial",
      "machine learning", "open models", "OpenAI", "startup",
    ]);
    expect(await (form.get("file") as Blob).text()).toBe("audio");
  });

  it("retries once without keyterms after a 4xx response", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 422 }))
      .mockResolvedValueOnce(Response.json({ text: "Try the plain request." }));
    vi.stubGlobal("fetch", fetch);

    expect((await transcribe(new Blob(["audio"]))).text).toBe("Try the plain request.");
    expect(fetch).toHaveBeenCalledTimes(2);
    const retry = fetch.mock.calls[1][1] as RequestInit;
    expect((retry.body as FormData).getAll("keyterms")).toEqual([]);
    expect(await ((retry.body as FormData).get("file") as Blob).text()).toBe("audio");
  });

  it("reports a failed fallback using only the HTTP status", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("Private upstream details", { status: 401 }));
    vi.stubGlobal("fetch", fetch);
    await expect(transcribe(new Blob(["audio"]))).rejects.toThrow("Transcription failed (401)");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry server errors as keyterms failures", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    await expect(transcribe(new Blob(["audio"]))).rejects.toThrow("Transcription failed (503)");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("returns an empty transcript when no text is present", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({})));
    expect((await transcribe(new Blob(["audio"]))).text).toBe("");
  });

  it("propagates a request timeout without retrying", async () => {
    const fetch = vi.fn().mockRejectedValue(new DOMException("Request timed out", "TimeoutError"));
    vi.stubGlobal("fetch", fetch);
    await expect(transcribe(new Blob(["audio"]))).rejects.toThrow("Request timed out");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
