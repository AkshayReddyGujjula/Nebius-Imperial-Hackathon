# Decision Lab — 3-minute demo story

**One line:** Decision Lab is a conversation that helps you make a hard decision. While you talk, open models on Nebius research it in parallel, and every agent shares one memory of you (`user.md`). It never tells you what to do; it shows you what the decision hinges on, with checked evidence.

## Before you go on stage (16:15)
- `npm run dev` is running; open http://localhost:5173 in Chrome at 100% zoom, full screen, Simple mode.
- Do one warm-up conversation at 16:15 so the models are warm.
- Fallback ready: **Replay a recorded run** (under the composer). If Nebius returns 503s or the Wi-Fi drops, use it and say "this is a recorded run of exactly this".
- Have the phone hotspot on standby.

## The story (≈3:00)

**0:00 — Hook (no screen yet).**
"Who here has a deadline clash this week? I do. I've got a hackathon — this one — and my machine-learning exam is the day after. Should I even be here? Chatbots will just tell me 'it depends' or pick for me. I wanted something that actually understands *me*, does the research, and lets *me* decide."

**0:15 — Start the conversation.**
Click the example chip *"Hackathon tomorrow, exam the day after — should I go?"* (or say it into the mic). Press Enter.
Say: "I just talk to it. And notice — it's already researching while it replies."
Point at: the canvas on the right growing (decision → 4 research questions), and the reply in the chat.

**0:35 — It asks about me, one question at a time.**
Point at the multiple-choice answers and the *Likely* tag.
Say: "It asks one question at a time, with one-tap answers — or I type my own. It's working out what actually matters to me."
Tap: **"Big: sponsors and recruiters."** Then answer the next one: **"Scraped through."**

**0:55 — Shared memory (the key idea).**
Point at the *What I know about you · user.md* card as it highlights the new lines.
Say: "Every answer goes into a shared memory file — user.md. Every agent reads it: the planner, the four research agents, the writer. So they stay in sync, it never asks me the same thing twice, and the research tailors itself — my exam answer just pushed exam performance up the weights."

**1:15 — Who is doing what (open models on Nebius).**
Switch the left panel to **Research** (or point at the agent badges on the cards).
Say: "All of this runs on open models on Nebius Token Factory. DeepSeek V4.1 Flash plans at max reasoning and runs four research agents in parallel — the planner gave each its own effort level. NVIDIA Nemotron writes these live summaries. And a different model family, MiniMax, audits the agents for contradictions. Search is Tavily, which Nebius is acquiring."

**1:40 — Where the models struggle (judges care about this).**
Press **D** (Detailed). Click a finding → the quote is highlighted in its source.
Say: "Open models hallucinate — DeepSeek's non-hallucination rate is about a third. So we don't trust it: every quote is checked against the page *in code*. Amber means the model paraphrased and called it a quote — we show that instead of hiding it. Same-model agents aren't independent, which is why the auditor is a different family. And we found real limits: GLM returned empty summaries half the time, max effort varies 10× run to run, and Nebius had 503 outages — we retry and fall back."

**2:10 — The decision brief: no verdict.**
Point at the **Decision brief** card / the assistant's summary in the chat.
Say: "It never tells me what to do. It tells me what it hinges on — *how much the exam mark matters versus the recruiter access* — with the stats on each side, and 'if you value X most, here's what fits'. Then it asks me the next question. I can stop whenever I'm ready, or keep going."

**2:30 — My priorities, my ranking.**
Press **M** (matrix). Raise **Exam performance**.
Say: "The trade-offs are my weights, and the maths is done in code, not by the model. If I care more about the exam… the ranking moves. The AI didn't change its mind — my priorities did."

**2:45 — Close.**
Point at the progress bar / Checks tab (cost, speed-up).
Say: "Four agents in parallel, [N]× faster than in sequence, about four cents a decision. Decision Lab: talk it through, see the evidence, decide for yourself."

## Numbers you can quote (all real, from our runs)
- One decision: about **$0.03–0.04** in Nebius tokens; about **55–70 s** of research; **2.4–3.5×** faster in parallel than in sequence.
- Quote checks: **12 of 12** quotes verified in the recorded hackathon run.
- Smoke tests: GLM-5.3-Flash returned empty summaries **3 of 6** times → switched to NVIDIA Nemotron (~0.3 s per line). Max effort used **1.3k–12k** reasoning tokens on the same problem.
- Speech-to-text: ElevenLabs Scribe v2 transcribed a spoken decision in **~2 s** (Token Factory has no speech model).

## Likely questions
- **"Isn't this just a chatbot?"** — A chatbot answers. This researches in parallel while it talks, checks every quote in code, keeps a shared memory of you that every agent reads, and never picks for you.
- **"Why not tell me the answer?"** — Because the right answer depends on what you value. We show the evidence and the trade-offs; the matrix ranks by *your* weights.
- **"How do you know it's not hallucinating?"** — We don't trust it: every quote is matched against the retrieved page in code, and a different model family audits for contradictions. Failures are shown, not hidden.
- **"Cost?"** — About four cents per decision on Nebius, plus ~30 Tavily credits.
- **"What's next?"** — Persist user.md across decisions (it already lives in a file), team decisions with dissent, and fine-tuning the planner on accepted plans via Token Factory.

## If something goes wrong
- A run fails or stalls > 20 s → **New decision → Replay a recorded run** → pick the hackathon one. Say it's a recording.
- An update fails → the previous brief stays with **Try again**; mention Nebius 503s honestly — it's part of the "where models struggle" story.
- Mic fails → type it.
