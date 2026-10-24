export type NodeKind = "decision" | "question" | "finding" | "blindspot" | "recommendation";

export const nodeId = {
  decision: "decision",
  blindspot: "blindspot",
  recommendation: "recommendation",
  question: (questionId: string) => `q:${questionId}`,
  finding: (findingId: string) => `f:${findingId}`,
} as const;

export function parseNodeId(id: string): { kind: NodeKind; ref: string | null } {
  if (id === "decision" || id === "blindspot" || id === "recommendation") return { kind: id, ref: null };
  if (id.startsWith("q:")) return { kind: "question", ref: id.slice(2) };
  if (id.startsWith("f:")) return { kind: "finding", ref: id.slice(2) };
  throw new Error(`Unknown node id: ${id}`);
}

export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (k.toLowerCase().startsWith("utm_")) u.searchParams.delete(k);
    let s = `${u.protocol}//${u.hostname.replace(/^www\./, "")}${u.pathname}${u.search}`;
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}
