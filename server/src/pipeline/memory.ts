import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG } from "../config";
import type { RunContext } from "../runs/types";

/** Sections of user.md, in order. Chat turns name one of these when they add a bullet. */
export const MEMORY_SECTIONS = ["The decision", "About you", "What matters to you", "Constraints", "Still unknown"] as const;
export type MemoryChange = { section: string; text: string };

const HEADER = "# user.md — what Decision Lab knows about you";

/** Maps a loose section name from the model onto one of ours ("about me" → "About you"). */
function resolveSection(name: string): string {
  const n = name.toLowerCase();
  if (/decision/.test(n)) return "The decision";
  if (/matter|value|priorit|care/.test(n)) return "What matters to you";
  if (/constraint|limit|deadline|time|money/.test(n)) return "Constraints";
  if (/unknown|open|question/.test(n)) return "Still unknown";
  return "About you";
}

function render(sections: Map<string, string[]>): string {
  const out = [HEADER, ""];
  for (const s of MEMORY_SECTIONS) {
    out.push(`## ${s}`);
    const items = sections.get(s) ?? [];
    out.push(...(items.length ? items : ["- "]), "");
  }
  return out.join("\n").trimEnd() + "\n";
}

function parse(markdown: string): Map<string, string[]> {
  const sections = new Map<string, string[]>(MEMORY_SECTIONS.map((s) => [s, []]));
  let cur: string | null = null;
  for (const line of markdown.split("\n")) {
    const h = line.match(/^## (.+)$/);
    if (h) { cur = MEMORY_SECTIONS.includes(h[1].trim() as any) ? h[1].trim() : null; continue; }
    if (cur && line.trim() && line.trim() !== "-") sections.get(cur)!.push(line);
  }
  return sections;
}

function write(ctx: RunContext, markdown: string, changes: string[], by: string): void {
  ctx.state.memory = markdown;
  ctx.emit({ type: "memory.updated", markdown, changes, by });
  if (ctx.state.replay) return;
  writeFile(join(CONFIG.runsDir, `${ctx.state.id}.user.md`), markdown, "utf8").catch(() => { /* best effort */ });
}

/** Deterministic and instant, so the planner can read it straight away. */
export function initMemory(ctx: RunContext): void {
  const quoted = ctx.state.decision.trim().split("\n").map((l) => `> ${l}`).join("\n");
  const sections = new Map<string, string[]>(MEMORY_SECTIONS.map((s) => [s, []]));
  sections.set("The decision", [quoted]);
  write(ctx, render(sections), [], "init");
}

/** Appends bullets to their sections, skipping near-duplicates. Never throws. */
export function updateMemory(ctx: RunContext, changes: MemoryChange[], by: string): string[] {
  try {
    const sections = parse(ctx.state.memory || render(new Map()));
    const norm = (s: string) => s.toLowerCase().replace(/^[-*>\s]+/, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
    const applied: string[] = [];
    for (const c of changes) {
      const text = String(c?.text ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
      if (!text) continue;
      const section = resolveSection(String(c?.section ?? ""));
      if (section === "The decision") continue;   // the decision is the person's own words; never rewritten
      const items = sections.get(section)!;
      const all = [...sections.values()].flat().map(norm);
      if (all.includes(norm(text))) continue;
      items.push(`- ${text}`);
      applied.push(text);
    }
    if (applied.length) write(ctx, render(sections), applied, by);
    return applied;
  } catch {
    return [];
  }
}
