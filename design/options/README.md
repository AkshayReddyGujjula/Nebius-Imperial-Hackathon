# Design options — decision research canvas

Static, self-contained mockups (open each file directly in a browser; Inter + JetBrains Mono from Google Fonts, Lucide from unpkg). Every file shows: the canvas mid-run, the agents/activity view, the trade-off matrix, the checks + run stats, and the empty/start state. "Forkline" is a placeholder product name.

| File | Direction |
|---|---|
| `option-a.html` | **Left-to-right canvas + 360 px activity panel.** The tree reads decision → options and questions → findings (as nodes, with citation chips) → recommendation. The right panel has tabs: Agents (live log per agent) · Trade-offs (expands to 780 px over the canvas) · Checks. The composer is docked under the canvas, and run stats sit in the top bar. |
| `option-b.html` | **Top-down tree + left run-timeline rail + bottom matrix drawer.** The decision sits on top, branches fan out below it, findings hang under each branch, and everything converges into one full-width recommendation bar. The left rail switches between Timeline (the run's story with timestamps) and Checks. The matrix is a bottom drawer: collapsed it shows the leader, open it shows options × criteria with the weight steppers in the header. |
| `option-c.html` | **Three columns: Agents · Map · Inspector.** The map is an overview with one node per branch, and findings are summarised as count badges (✓ / ⚠ / contradiction). The inspector shows the selected node's findings, quotes, verification, sources, contradiction and the "Dig deeper at max effort" action. The centre toggles between Map and Matrix, and selecting a matrix cell shows its justification and an override in the inspector. Run stats are in a bottom status bar. |

## Shared design tokens (identical in all three)

- **Fonts**: Inter 400/500/600 (UI). JetBrains Mono 400/500 (citations, logs, timestamps). All numbers use `font-variant-numeric: tabular-nums`.
- **Type scale (px, size/line-height)**:
  - 11/14 uppercase labels (+0.04em tracking)
  - 12/16 meta
  - 13/19 secondary body and findings
  - 14/20 body and node titles (500)
  - 15–17/22–24 decision root
  - 20–28 KPI numbers (600)
  - 22–24/30–32 empty-state heading (600, −0.015em)
- **Neutrals**:
  - Page background `#F7F7F8`, with a canvas dot grid in `#DCDCE0` (1 px dots, 20 px pitch)
  - Surface `#FFFFFF`, subtle `#F4F4F5`, hover `#FAFAFA`
  - Border `#E4E4E7`, strong border `#D4D4D8`, tree connectors `#C9C9D0`
  - Text `#18181B`, `#52525B`, `#71717A`, `#A1A1AA`
- **Accent (the only accent colour)**: `#2563EB`
  - Soft fill `#EFF6FF`, border `#BFDBFE`, text `#1D4ED8`
  - Used for: the selected node and its path, the active/searching state, the leading option, and user-set ("You") cells.
- **Semantic colours** (status only):
  - ok `#15803D` / `#F0FDF4` / `#BBF7D0`
  - warn `#B45309` / `#FFFBEB` / `#FDE68A` (bar fill `#D97706`)
  - bad `#B91C1C` / `#FEF2F2` / `#FECACA`; the contradiction line is `#DC2626`, dashed 3 3
- **Radius**: 6 (chips, badges, inputs) · 8 (nodes, buttons, cards) · 12 (composer) · 999 (pills)
- **Border**: 1 px everywhere.
  - Selected node: `border-color: accent` plus a `0 0 0 1px accent` ring.
  - Blind spot: 1 px **dashed** `#A1A1AA`.
  - Pending/queued links: dashed 4 4.
- **Shadow**:
  - sm `0 1px 2px rgba(24,24,27,.05)`
  - base `0 1px 3px rgba(24,24,27,.07), 0 1px 2px rgba(24,24,27,.04)`
  - pop `0 8px 24px rgba(24,24,27,.08), 0 2px 6px rgba(24,24,27,.05)`
  - No glows.
- **Spacing**: 4 px base, using 4 / 6 / 8 / 12 / 16 / 24 / 32 / 40. The top bar is 52 px, panel/rail widths are 280–360 px, and the gap between tree columns is 28–40 px.
- **Motion**:
  - 150 ms `cubic-bezier(.2,0,0,1)` for hover, border and tab changes.
  - The active status dot pulses on opacity only (1 → .35, 1.6 s ease-in-out, infinite).
  - New nodes should fade in with a 4 px rise over 200 ms (not mocked).
- **Status states**: queued (hollow grey ring) · searching / reading N/M (pulsing accent dot, accent text) · done (green) · failed (red). A legend is always visible on the canvas.
- **Effort badge**: three ascending bars (low = 1 filled, high = 2, max = 3) plus a word, followed by a one-line reason in muted text.
- **Citation chip**: mono domain + icon.
  - Verified: green `badge-check`.
  - Quote not found: amber fill and border with an `alert-triangle`.
  - Pending: grey loader.
- **Matrix cell**: a 1–5 number, five pips, and a source tag. The `AI` tag is dashed grey; the `You` tag is solid accent-soft. The total is Σ(w·s)/Σw, computed in code.
