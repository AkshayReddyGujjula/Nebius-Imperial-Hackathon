# Maxmin / MindMapper: research and hackathon plan

Research date: **24 October 2026, Europe/London**.

Status: researched proposal, not an implemented or benchmarked application. This file is the requested deliverable. Research used three GPT-6 Luna workers, current primary documentation, independent benchmark publishers, the existing MindMapper ChatGPT discussion, and read-only inspection of the local project folders. No model weights were downloaded, inference calls made, accounts created, applications run, or sibling project files changed.

## 1. Recommendation and decision summary

Build a **voice-first decision workspace**: speak freely, inspect a map of your own reasoning, reveal a possible blind spot, and explore how changing an assumption or priority changes the comparison.

The strongest coherent combination is:

1. **Maxmin / MindMapper** as the persistent, transcript-grounded reasoning map.
2. **Blind Spot** as an opt-in ghost layer: a missing option, assumption, counterargument, or question, visibly separate from what the user said.
3. **Visual trade-offs** as the demonstrable engine: explicitly change a priority or assumption and show the affected comparisons.
4. **Parallel Lives** as short, conditional future scenarios attached to options, rather than predictions.
5. **An agent council** as a bounded review mode for a selected question, rather than the always-running interface.

The suggested pitch is: **Say what is on your mind. See what your decision depends on. Explore what would change your mind.**

Model recommendations are provisional until a small evaluation on the actual laptop, microphone, accent, network and Nebius account:

| Feature | First candidate | Challenger / fallback | Selection condition |
|---|---|---|---|
| Live cloud speech recognition | Muse Voice Transcribe and Grok Voice Transcribe 2.0 as the first audition | MAI Transcribe-2 if Azure is ready; Scribe v2 Realtime as an established baseline | Preserve meaning first; benchmark exact current versions before choosing |
| Recorded-turn or audio-upload transcription | GPT Transcribe | The same streaming provider used for live input | Better accuracy must justify waiting until the turn is committed |
| Local live speech | Moonshine Small/Medium Streaming if the laptop can sustain it | Tiny for a speed gate; whisper.cpp small.en/OpenVINO | Do not pick Tiny solely for speed if it loses decision-critical words |
| Additional local accuracy experiment | Underdog Bark 3.0 / Plus; Qwen3-ASR-0.6B | Parakeet TDT 0.6B v3 | File/windowed inference must satisfy the actual interaction; small download is not low RAM or low latency |
| Fast graph extraction | Qwen3.8-27B with thinking disabled, if Nebius supports the control | DeepSeek 1017 at supported lower effort; Qwen3-30B-A3B-Instruct-2507 as a JSON-capable baseline | Quality gate first, then time to a valid patch; none is a measured app winner yet |
| Blind-spot proposals and scenario analysis | DeepSeek V4.1 Flash 1017 | GLM-5.3-Flash as a distinct critic | Deeper reasoning runs outside the live transcription path |
| Routing | Code rules plus a review recommendation from extraction | A separate classifier only if measurements show a benefit | Explicit user actions override model routing |
| Numeric trade-off calculation | Ordinary application code | No model needed | User supplies values, scales and weights; missing values remain unknown |
| Optional local voice output | Phonon 31M English | Kokoro-82M or Pocket TTS | Measure first audible output and pronunciation on Windows |
| Expressive voice-output experiment | Ming-3.0-tts-0.5B | Hosted NVIDIA inference if later required | Not a demonstrated local Intel/Windows path |

There is no evidence yet that one model is best across all these tasks. Coding or general intelligence benchmarks narrow the search; they do not establish faithful reasoning-map extraction or reliable fallacy detection.

## 2. Requirements, constraints and evidence standard

### Confirmed requirements

- Two builders, approximately six hours, with Claude Code and Codex available for implementation.
- English-only speech for the hackathon.
- Around $200 combined **Nebius Token Factory** credits.
- Quality and low user-visible latency matter most. Roughly $1/hour is acceptable.
- Prefer local speech models below one billion parameters where practical; cloud STT is acceptable when it gives better quality or responsiveness.
- Investigate DeepSeek V4.1 Flash 1017, variable reasoning and classifier-driven routing.
- Explore Parallel Lives, Blind Spot/ghost mode, an agent council, visual trade-offs and the existing Maxmin/MindMapper concept.
- Deliver this plan in the repository root; do not begin implementation as part of this task.

The budget calculations below conservatively interpret $1/hour as total inference cost per active user-hour. This is a planning interpretation, not a billing commitment. The $200 credit balance was provided by the user; account-specific access, expiry and terms were not inspected.

### Event fit

The [Noetic x Nebius brief](https://luma.com/qa1ds94p) describes an open challenge using open models on Token Factory, with a working demo that has a clear purpose and acknowledges model limitations. Its advertised build window is 11:30–16:30, while the user's working allowance is six hours. The public listing says teams of 3–5; confirm that a two-person team is accepted. Existing-code reuse rules, detailed judging criteria and prize criteria were not established by the page.

Keep meaningful reasoning and graph analysis on Nebius. Using an external STT service does not by itself demonstrate use of open models on Token Factory. Do not claim this plan is guaranteed eligible until the actual challenge briefing is checked.

### Evidence labels used in this plan

| Label | Meaning |
|---|---|
| Current documentation/catalog | A capability or price currently published by its provider; account access can still vary |
| Independent benchmark | A measurement by an evaluation publisher, with its own workload and limitations |
| Author/vendor result | A model author's or vendor's measurement; not independently reproduced here |
| Local source inspection | Code or documentation exists; successful current execution was not established |
| Proposed target/design | A recommendation or acceptance criterion, not an observed result |
| Unverified | A needed inference, integration behavior or measurement remains open |

A fast token rate is not a fast useful answer. Keep these measurements separate:

- first partial transcript;
- stable/final transcript after speech ends;
- model first chunk, including a reasoning chunk;
- first answer token;
- first schema-valid graph patch;
- completed challenge or scenario;
- time until that result is visible in the UI.

## 3. Product ideas and what each should actually do

### 3.1 Maxmin / MindMapper: inspectable reasoning

The existing [MindMapper discussion](https://chatgpt.com/g/g-p-6aad614e75a8819186b21643c356d597-agentic-ai-hack-tech-europe/c/6ab0e1b9-ebfc-83eb-a6f9-4f86e3272ba9) already explored a reasoning IDE: speech becomes a graph; inexpensive checks remain quiet; selected assumptions are perturbed; research is allocated to unknowns that could change the decision. This is recovered prior ideation, not a new invention in this document. The final summary message in that chat did not load in the browser, but its substantial reasoning-IDE proposal was readable.

The important artifact is an editable map containing the user's own claims, assumptions, priorities, options, constraints and open questions. Every extracted point should lead back to the transcript span that produced it. AI-inferred links need a distinct visual treatment and an editable status.

Do not display a model's hidden chain of thought as an explanation. Show source spans, concise reasons, explicit assumptions, evidence and changes the user can inspect.

### 3.2 Blind Spot: an opt-in ghost layer

**Interaction:** press Reveal a blind spot, or select a branch and ask What am I overlooking?

The model returns at most one or two useful possibilities:

- an overlooked option;
- an assumption that has not been established;
- an alternative explanation;
- a constraint or stakeholder absent from the comparison;
- a question whose answer could change the decision.

Render suggestions as ghost nodes outside the solid user-owned graph. Each needs a reason tied to an existing node or transcript span. Offer Add to map, Edit, Dismiss and Ask me a question. Promotion records user acceptance but retains AI provenance; it must not rewrite the suggestion as something the user originally said.

Allow **no useful blind spot found**. Requiring a critique on every request manufactures problems. A user can legitimately value stability, prefer a familiar tool or continue an existing project without committing a fallacy.

**Example:** “I prefer offer A because it pays more, but mentoring matters most to me.” The useful ghost may ask who would review the user's work at each company. It should not invent a claim that either company has poor mentoring.

**Role:** strongest product hook and a natural extension of Maxmin's existing quiet, peripheral card design.

### 3.3 Visual trade-off engine

**Interaction:** compare two or three options against user-stated criteria; change a priority or assumption and see the comparison update.

Begin qualitatively: strengths, costs, unknowns, reversibility, and evidence for each. Add numeric weighting only when the user explicitly supplies the values and scales. The model can suggest criteria; it must not silently assign the user's priorities or fabricate option scores.

For a transparent illustrative calculation, suppose the user chooses weights learning 0.50, stability 0.30 and cash 0.20, and rates two options on the same 1–5 scale:

| Option | Learning | Stability | Cash | Weighted result |
|---|---:|---:|---:|---:|
| A | 5 | 2 | 3 | 3.70 |
| B | 3 | 5 | 4 | 3.80 |

If the same user changes the weights to 0.70, 0.15 and 0.15, A becomes 4.25 and B becomes 3.45. Application code calculates this. These are examples of preference sensitivity under declared inputs, not probabilities of a good life or objectively correct choices.

Unknown values should produce an interval or an unresolved comparison, not a zero. Warn when a changed scale, duplicated criterion or strongly overlapping criteria makes a weighted sum misleading. For criteria that do not need a compensatory score, show a hard constraint or a Pareto comparison instead.

**Role:** best visible engineering demonstration because a changed input produces an inspectable result.

### 3.4 Parallel Lives: conditional scenario branches

**Interaction:** choose an option and a horizon, such as six weeks or six months. Explore a favorable case, a difficult case and a plausible ordinary case.

Each branch should list:

1. the starting option and user-supplied assumptions;
2. external conditions that would need to hold;
3. plausible milestones and setbacks;
4. reversible actions or small experiments;
5. early signs that would contradict the scenario;
6. facts versus invented illustrative details.

Show two or three short branch cards, not pages of simulated autobiography. Prefer “If mentoring is available, this route could…” over “In six months you will…”. Do not infer probabilities from the number of agents that like a scenario.

Useful variant: compare **regret and reversibility**. Which option can be tested cheaply? What is the cost of changing course? What information can be gathered before committing?

**Role:** visually compelling scenario view, but lower epistemic certainty than a transcript-grounded map or explicit trade-off calculation. It becomes much stronger when linked to the same assumptions and evidence rather than presented as a separate fortune-telling feature.

### 3.5 AI agent council

**Interaction:** explicitly request review of one selected decision, assumption or scenario.

Use meaningful roles: a critic checks the weakest premise; a defender attempts the strongest charitable interpretation; an evidence reviewer checks which claims need support. If running in parallel, give each the same frozen graph version, independent initial instructions and a short output budget. Synthesize only after their responses arrive, preserving disagreements and missing evidence.

Return a compact disagreement table and two next questions. Avoid a majority-vote verdict, “three agents agree” confidence, or the suggestion that different prompts make one model independent experts.

A second model family can challenge correlated errors, but shared training data, prompts, sources and provider infrastructure can still produce correlated failures. Model diversity and a consensus label do not verify facts.

**Role:** optional deep-review mode. Parallel calls can reduce elapsed time compared with sequential debate, but still add load, cost and tail latency. Keep it off the live transcription/map path.

### 3.6 Further directions retained from the survey

| Idea | Strongest use | Why it is not the first recommendation |
|---|---|---|
| Formal Argument Debugger | User-approved translation of a small argument into logic; a solver finds a counterexample or verifies that formalization | Natural-language formalization is itself fallible; substantial separate scope |
| Team Decision Memory | Record proposals, dissent, assumptions and later outcomes with attribution | Needs speaker handling, durable history and revisiting; less immediate six-hour payoff |
| Evidence investigator using Jev | Check an externally testable factual premise and attach a source | Strong closing demo, but public-source retrieval is often simpler via search/HTTP than browser automation |
| Browser-agent arena | Compare open-model action policies using independent page assertions | Good engineering project, but farther from the user's current decision-support direction |
| Internship application copilot | Translate a shortlist into reviewed, prefilled applications | Jev has useful foundations; auth, changing forms and external submissions add demo uncertainty |
| Decision journal / future review | Save what the user expected before an outcome is known, revisit later | Valuable product extension; benefits take time to demonstrate |

### 3.7 Recommended scope, without discarding ambition

**Build spine:** speech/text → transcript → reasoning map → ghost challenge → explicit trade-off revision.

**Ambitious showcase:** add one Parallel Lives view using the same graph, then an optional bounded council for a selected branch. These are views and requests over one shared decision model, not separate applications.

**Fallback showcase:** a polished map, one excellent blind spot, and a visible revision after changing a priority. Keep typed input available; never disguise a fixture as live model output.

Keep the final choice with the user. The product's claim is that it makes assumptions and trade-offs inspectable, not that it has been proven to improve decisions.

## 4. Competition and differentiation

| Existing product/research | What overlaps | Consequence for this project |
|---|---|---|
| [Arguma](https://arguma.io/) | Typed reasoning maps, evidence relationships, assumptions and affected conclusions | A graph with colored nodes is not sufficient differentiation |
| [Decision Journal](https://decisionjournal.ai/) | Conversational decision capture, bias flags and outcome reflection | Voice plus bias warnings is already a product category |
| [Causara](https://www.causara.ai/product) | Assumptions, evidence traceability, scenarios, structured challenges and decision hinges; presented as an internal system | Even graph-plus-scenarios-plus-hinges is not an established novelty claim |
| [Parallel Lives](https://www.parallellives.ai/) and its [terms](https://app.parallellives.ai/terms) | Alternative future explorations, presented as hypothetical | Differentiate with assumptions, revision and useful experiments, not longer future narratives |
| [Perspect](https://www.tryperspect.com/connect), [Ask Once](https://decisioncouncil.com/) and [axilles](https://www.axilles.app/) | Panels, role-based critique and disagreement | A council is a mechanism, not the product advantage |
| [All-Seeing AI](https://all-seeing.ai/) | Quoted reasoning critiques, fallacy candidates and logic checks | “Paste text and detect fallacies” is not an unsolved category |
| [Perspectra, CHI 2026](https://doi.org/10.1145/3772318.3791560) | User-steered multi-agent research ideation and argument/thread interfaces | Useful design research; the reported 18-participant study does not establish general real-life debiasing |

The defensible design wedge is **faithful live capture, clearly separate AI suggestions, explicit user control, and visible changes when assumptions or priorities change**. This is a proposed experience to evaluate, not a claim that nobody has built the combination.

## 5. Speech recognition: local research

### 5.1 Actual target machine

Read-only system inspection found a Lenovo 83JX with Intel Core Ultra 7 258V, Intel Arc 140V and approximately 31.5 GB system RAM. The driver reports 16 GB for the GPU; treat this as a shared-memory report, not evidence of 16 GB dedicated VRAM. No local speech latency, throughput, memory or quality measurements were performed.

Parameter count, download size, runtime memory, accelerator support and time to final transcript are different constraints. A compact packed file may expand to much larger floating-point weights at runtime.

### 5.2 Local candidate table

| Model | Parameters / format notes | Streaming and hardware evidence | Decision |
|---|---|---|---|
| [Moonshine Medium / Small / Tiny Streaming](https://moonshine-voice.readthedocs.io/en/latest/models/available-models/) | 245M / 123M / 34M; MIT. Published English reference WER: 6.65% / 7.84% / 12.00%, respectively | Native incremental results; Windows library. Those WER values are floating-point references across eight datasets, not a score for the shipped quantized model on this laptop | Test Small/Medium for quality if real-time compute allows; Tiny is a quick feasibility probe |
| [Whisper small.en](https://github.com/openai/whisper) with [whisper.cpp](https://github.com/ggml-org/whisper.cpp) | 244M; small.en ggml file approximately 466 MiB; MIT | Buffered/rolling-window transcription. Documented Windows OpenVINO encoder acceleration; no Arc 140V latency result here | Strong practical Intel challenger |
| [Whisper large-v3-turbo](https://github.com/openai/whisper) | 809M; whisper.cpp full file about 1.5 GiB, smaller quantizations available | Chunked inference rather than native live streaming | Accuracy/throughput comparison if setup time permits, not assumed faster for short turns |
| [Distil-Whisper large-v3.5](https://huggingface.co/distil-whisper/distil-large-v3.5) | 756M; English; MIT | Buffered/chunked transcription; no target-laptop measurement | Secondary accuracy candidate |
| [Parakeet TDT 0.6B v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) | 600M; 25 European languages; CC-BY-4.0 | High-throughput transcription; card includes local runtimes, but NVIDIA GPU results do not establish Intel live latency | Good accuracy challenger; not evidence of native live suitability |
| [Canary-180M Flash](https://huggingface.co/nvidia/canary-180m-flash) | Actual stated size 182M; English and three other languages; CC-BY-4.0 | NeMo inference and streaming policies; published hardware results do not establish 258V performance | Interesting compact model, higher integration uncertainty |
| [Qwen3-ASR-0.6B](https://huggingface.co/Qwen/Qwen3-ASR-0.6B) | Apache 2.0; nominal 0.6B name, approximately 0.9B total shown on Hub; 1.88 GB weights | Unified offline/streaming toolkit. Its high-concurrency throughput claim is not single-user laptop latency | Worth an accuracy test; verify complete parameter count and chosen runtime |
| [Underdog Bark 3.0 / Plus](https://huggingface.co/ConwayResearch/Underdog-Bark-3.0) | 0.6B family; packed downloads about 163 / 180 MB; CC-BY-4.0 | Windows CPU path exists; expands to FP32 in memory. File/windowed transcription, no established Arc path or target-laptop timings | Promising newly released accuracy challenger; not automatically the fastest local stream |
| [Granite 4.0 1B Speech](https://huggingface.co/ibm-granite/granite-4.0-1b-speech) | Approximately 1B; Apache 2.0 | Multilingual ASR and keyword biasing | Near the stated size boundary rather than clearly under it; lower priority for this English six-hour build |

Do not directly rank the different authors' WER rows as if they used identical datasets, scoring, quantization and streaming settings. Bark's reported seven-set results are author measurements, not submitted independent leaderboard entries; its Mac speed does not transfer to Windows. Distinguish this ASR model from unrelated Bark speech-synthesis models.

### 5.3 Moonshine's Intel/Windows caveat

The maintainer's [Intel Windows issue #129](https://github.com/moonshine-ai/moonshine/issues/129) reports an Ultra 7 system taking 4.24 times audio duration for Medium and 1.44 times for Tiny. That is a different machine from the user's 258V. The issue's closed state does not document a successful fix; it was closed after investigation of an upstream runtime bottleneck. [Issue #133](https://github.com/moonshine-ai/moonshine/issues/133) discusses experimental execution-provider selection, not established Intel GPU acceleration.

This changes the recommendation: avoid spending the hackathon assuming RAM capacity guarantees real-time Moonshine performance. Time-box an early test, keep the model warm and compare against a cloud service. If compute consistently takes longer than incoming audio, the queue grows and a short demo can conceal a failing long session.

### 5.4 Local benchmark that determines the winner

Proposed, not executed:

1. Use 12–20 short recordings plus a five-minute freeform thought dump from the actual microphone; include pauses, technical names, numbers, negation and self-corrections.
2. Preserve a hand-corrected verbatim reference. Do not optimize only for clean dictation that removes hesitations or revisions.
3. Measure cold load separately; then warm first-partial latency, speech-end-to-final latency, real-time factor, peak memory and backlog over the long sample.
4. Start with Moonshine Tiny for a fast feasibility check, then Small/Medium if viable. Compare whisper.cpp small.en CPU and OpenVINO. Add Bark or Qwen if their expected quality benefit justifies integration time.
5. Choose the highest-quality option that sustains the intended update cadence. Record all negation/number changes separately from aggregate WER.

An initial engineering gate could require sustained real-time factor below 0.7 to leave room for UI and other work, no growing queue, and no meaning-changing error in the prepared demo set. These are proposed local acceptance targets, not evidence of zero errors in real use.

Moonshine's [benchmark documentation](https://moonshine-voice.readthedocs.io/en/latest/using/benchmarks/) explicitly separates phrase-finalization latency from bulk throughput. Reuse that distinction for every candidate.

## 6. Speech recognition: cloud research and GPT options

### 6.1 Nebius is not presently a documented STT API

The public [Token Factory catalog](https://tokenfactory.nebius.com/api/public/models_info) and [API reference](https://api.tokenfactory.nebius.com/docs) did not expose a speech/audio-transcription model, an audio-transcriptions route or a realtime audio socket. This is a finding about public documentation and catalog entries, not proof that private services cannot exist.

DeepSeek's text/image input does not imply audio input. OpenAI-compatible chat completions does not imply implementation of every OpenAI audio endpoint. Token Factory promotional credits do not establish payment coverage for another provider or general Nebius GPU hosting; check the actual grant terms. [Nebius billing documentation](https://docs.tokenfactory.nebius.com/other-capabilities/billing)

### 6.2 Current OpenAI transcription names

Current official documentation recommends:

| Model | Intended interaction | Published price | Hourly arithmetic |
|---|---|---:|---:|
| [GPT Live Transcribe](https://developers.openai.com/api/docs/models/gpt-live-transcribe), ID gpt-live-transcribe | Live microphone input with transcript deltas | $0.017/audio minute | $1.02 for 60 billed minutes, before reasoning |
| [GPT Transcribe](https://developers.openai.com/api/docs/models/gpt-transcribe), ID gpt-transcribe | Recorded/uploaded audio; also specialized committed-turn transcription | $0.0045/audio minute | $0.27 for 60 billed minutes |

The [live transcription guide](https://developers.openai.com/api/docs/guides/realtime-transcription) says gpt-live-transcribe accepts live audio and produces deltas before a completed turn. It requires client-side turn detection/commit in the documented configuration, supports vocabulary/context hints and configurable delay, and does not provide word timestamps, speaker labels or confidence scores. Turn completion ordering needs reconciliation by item ID.

The [file transcription guide](https://developers.openai.com/api/docs/guides/speech-to-text) distinguishes uploaded-file result streaming from live input. Setting stream=true for an already recorded file does not convert that API into continuous microphone recognition. A committed-turn model starts substantial work after the audio turn ends, so it may be appropriate for push-to-think even if it is not the live-caption winner.

The [deprecations page](https://developers.openai.com/api/docs/deprecations) lists the older Whisper and GPT-4o transcription family as deprecated in August 2026, with shutdown in February 2027. Do not choose legacy model names from old examples for a fresh integration without checking their current status. GPT Realtime Whisper is also not the recommended starting point in the current guidance.

Important correction to earlier informal discussion: GPT transcription need not be “too expensive,” but live and committed/file modes have materially different prices and interaction costs. The current live model slightly exceeds a strict $1/hour total budget even before Nebius; the recorded-turn model leaves substantial room.

Account eligibility, actual billed duration, network location and performance of these exact current models were not tested.

### 6.3 Quality must be compared on the same task

For cloud finalists, compare final semantic accuracy, partial revisions, time to final, and what the application must do for endpointing. A fast display of unstable text is useful for captions but insufficient authority to create permanent reasoning nodes.

Provider-final text also is not a complete human thought. The user can finish one utterance and correct it in the next. Preserve cross-turn merging and retractions rather than treating a provider's final event as immutable human intent.

### 6.4 Cloud shortlist and operational differences

Prices below are published indications, not account quotes. Extra keyterms, prompting, plan minimums or session billing may change the total.

| Provider/model | Published base price / audio hour | Behavior relevant to this product | Position |
|---|---:|---|---|
| [ElevenLabs Scribe v2 Realtime](https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime) | About $0.39 | Replaceable partials; stable committed transcripts; manual or VAD commit; vocabulary hints | Established quality/latency finalist |
| [Cartesia Ink-2](https://cartesia.ai/ink) | Plan/credit dependent; obtain current quote | Semantic and external endpoint configurations must be compared separately | Quality finalist if access and pricing work |
| [Deepgram Nova-3](https://developers.deepgram.com/docs/models-languages-overview) | Current promo $0.288 English; regular displayed rate $0.462 | General streaming ASR; separate endpoint/finalization configuration | Straightforward accuracy/price baseline |
| [Deepgram Flux English](https://developers.deepgram.com/docs/flux/quickstart) | Current promo $0.39; regular displayed rate $0.462 | Conversational model with native turn detection | Compare if turn-taking is more important than raw transcript quality |
| [Soniox stt-rt-v5](https://soniox.com/docs/stt/rt/real-time-transcription) | Approximately $0.12 | Provisional versus final tokens; semantic or manual finalization; context hints | Strong value challenger, not selected on price alone |
| [AssemblyAI realtime](https://www.assemblyai.com/products/streaming-speech-to-text) | Public 3.5 Pro baseline about $0.45 | Explicit end-of-turn events; keyterms; billable socket duration | Useful integration challenger; version/default documentation needs reconciliation |
| [GPT Live Transcribe](https://developers.openai.com/api/docs/models/gpt-live-transcribe) | $1.02 | Continuous deltas; configurable delay; application-controlled turn commit | Quality challenger slightly over a strict total-hour budget |
| [GPT Transcribe](https://developers.openai.com/api/docs/models/gpt-transcribe) | $0.27 | File/committed-turn workflow | Best OpenAI budget-fit candidate for push-to-think |

Sources for rates and caveats: [ElevenLabs pricing](https://elevenlabs.io/pricing/api?price.section=speech_to_text), [Deepgram pricing](https://deepgram.com/pricing), [Soniox pricing](https://soniox.com/pricing), [AssemblyAI pricing](https://www.assemblyai.com/pricing/), and the two official OpenAI model cards above.

Source conflicts that must remain visible:

- ElevenLabs' keyterm surcharge differs between the API reference and pricing FAQ: 20% versus $0.05/hour. At a $0.39 base, those imply roughly $0.468 or $0.44/hour. Verify the account's actual rate.
- Deepgram's displayed streaming prices are promotional and have higher regular rates. Do not budget solely against a discount of unknown duration. Its documentation exposes an EU endpoint; use it only after checking account support.
- AssemblyAI's product pages, roadmap and API documentation do not consistently identify the same latest 3.5/3.6/default model. Pin the actual accepted identifier, rather than relying on the provider default. Its [streaming quickstart](https://www.assemblyai.com/docs/streaming/getting-started/transcribe-streaming-audio) documents socket-session billing, including idle time.
- Soniox's [vendor-hosted benchmark](https://soniox.com/benchmarks) reports v5 at 260 ms median final-segment latency on a separate Pipecat evaluation. That is useful evidence, but is not directly comparable with another publisher's WER or latency.
- None of the reviewed comparisons established specific negation preservation for the user's speech. Evaluate it directly.

### 6.5 Independent evidence, historical snapshots and current leaders

[Artificial Analysis's current streaming leaderboard](https://artificialanalysis.ai/speech-to-text/streaming) was opened in the real browser on the research date, rather than relying only on an older launch article. Its visible headline chart included these rounded final-WER figures: MAI-Transcribe-2-Streaming 2.5%, Grok Voice Transcribe 2.0 2.7%, Muse Voice Transcribe 3.1%, Cartesia Ink-2 semantic 3.4%, Scribe v2 Realtime 3.6%, and Gemini 3.5 Transcribe Live 4.0%. Rounded headline values are not a complete exported leaderboard.

That changes the conclusion: **Scribe is an established practical finalist, not proven today's overall quality winner.** Newer leaders need API-access, pricing and operational checks before selecting an overall winner.

The evaluator's [June benchmark article](https://artificialanalysis.ai/articles/new-streaming-speech-to-text-benchmark-aa-wer-streaming/) is a historical snapshot. It reported strong Scribe and Cartesia results, but tested older Soniox, AssemblyAI and OpenAI configurations. Do not assign its old Soniox score to v5 or its GPT Realtime Whisper score to GPT Live Transcribe.

The [methodology](https://artificialanalysis.ai/methodology/speech-to-text) uses roughly eight hours across three datasets, weighted 50% conversational agent talk, 25% parliamentary speech and 25% earnings calls. Latency is measured after detected speech end; endpoint forcing and natural finalization affect comparability. It is not the full speech-to-graph delay, and its dataset mixture is not a guarantee for a rambling student decision discussion.

The final selection process is: verify exact API access and price for current quality leaders; benchmark two of them plus Scribe or Soniox on the same thought dumps; choose by decision-critical meaning preservation first, then stable-final and graph latency.

### 6.6 Current quality leaders: access and cost checked

| Candidate | Published access / price | Practical significance |
|---|---|---|
| [MAI-Transcribe-2-Streaming](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/mai-transcribe-2-streaming) | Microsoft Foundry public preview; resource and deployment required. Public pricing rendered no usable numeric amount in the retrieved page | Strongest rounded current WER in the inspected chart, approximately 2.5%, with approximately 0.13 s finalization. Worth testing if Azure is already configured; budget fit is unverified |
| [Grok Voice Transcribe 2.0](https://docs.x.ai/developers/models/speech-to-text) | ID grok-voice-transcribe-2.0; published $0.20/audio hour; streaming API documented as GA | Approximately 2.7% current headline WER; a leading practical quality candidate, not a measured app winner |
| [Muse Voice Transcribe](https://dev.meta.ai/docs/speech-to-text) | ID muse-voice-transcribe-1.0; published $0.18/audio hour | Approximately 3.1% current headline WER and 0.16 s finalization; strong quality/latency candidate with model endpointing |

The [MAI realtime protocol](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/mai-transcribe-2-streaming-realtime) requires client commits and does not support server VAD in the documented configuration. It has one-hour sessions and selectable deployment regions, including Sweden Central. Its [public pricing page](https://azure.microsoft.com/en-us/pricing/details/speech/) did not expose a verified numeric price in retrieved text, so the plan does not invent one.

The [xAI streaming reference](https://docs.x.ai/developers/rest-api-reference/inference/speech-to-text) exposes partials, manual finalization and endpointing controls. Defaults such as a roughly 500 ms partial cadence or 400 ms endpoint timeout are configuration behavior, not a full latency guarantee. The reviewed model page names us-east-1; measure London-network performance and do not assume an EU endpoint or a particular silence-billing rule.

[Meta's pricing and limits](https://dev.meta.ai/docs/pricing-rate-limits) describe audio-processed billing and a 60-minute session limit. Its partials can be revised; final text is marked explicitly. The reviewed guide documents turn-level rather than word-level timestamps and does not establish a processing region. Do not invent word confidence values for providers that do not supply them.

**Revised recommendation after checking current leaders:** audition Muse and Grok first, retain Scribe as a quality/latency baseline, and include MAI if setup is available and price can be confirmed. Soniox remains a worthwhile price challenger, but the earlier tentative preference for it is superseded by the broader current quality research. All remain external to the Token Factory credit balance.

## 7. Voice output: researched now, optional in the build

The two supplied X links were read through the browser and traced to their primary model cards:

- [Artificial Analysis's Ming post](https://x.com/ArtificialAnlys/status/2113380805552857591): about **text-to-speech**, not recognition.
- [Gradium's Phonon post](https://x.com/GradiumAI/status/2112563128487514512): also **text-to-speech**.

| Candidate | Useful evidence | Recommendation |
|---|---|---|
| [Phonon 31M English](https://huggingface.co/gradium/phonon-31m-en) | Apache 2.0; 64.5 MB q8 weights; streaming audio; nominal count excludes audio tokenizer | First local-output candidate |
| [Phonon runtime](https://github.com/gradium-ai/xn-ptts) | Rust, CPU and browser integrations; no PyTorch required | Test actual Windows delivery, complete asset size and first audible output |
| [Phonon 40M variants](https://gradium.ai/phonon) | Larger English/multilingual options carry non-commercial terms in the published model table | Not the default commercial-friendly choice |
| [Ming-3.0-tts-0.5B](https://huggingface.co/inclusionAI/Ming-3.0-tts-0.5B) | MIT; expressive multilingual synthesis, English voices and style controls; published setup tested on NVIDIA CUDA | Later expressive-output experiment, not an established Intel laptop path |
| [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) | Apache 2.0; compact TTS baseline with a broad ecosystem | Useful baseline if its chosen Windows runtime is simpler |
| [Pocket TTS](https://github.com/kyutai-labs/pocket-tts) | CPU-oriented runtime; October release includes small English variants down to approximately 2M with decoder included | Alternative for a very small local output layer; evaluate naturalness and intelligibility |

Phonon's launch latency claims were measured on specified hardware, not this 258V. Ming's parameter label does not establish low complete-pipeline latency, runtime memory, Windows support or incremental audio delivery. These were not benchmarked here.

TTS should read a short user-requested challenge or scenario, not narrate every graph update. Stop playback immediately when the user speaks; avoid microphone feedback loops. Keep voice output opt-in so the main thinking flow can remain quiet.

## 8. Model routing and system architecture

### 8.1 The fast and deep paths

~~~text
Microphone or typed input
    |
    v
Speech adapter: provisional text -> committed utterance -> corrections
    |
    v
Transcript store + user edits + version IDs
    |
    v
Fast extraction request
    |-- typed graph patch + exact source spans
    |-- optional review recommendation
    v
Code validates and applies a version-matched patch
    |
    +--> render the user's map immediately
    |
    +--> selected node / explicit action
             |
             +--> Blind Spot ghost proposal
             +--> Parallel Lives conditional scenarios
             +--> user-weighted trade-off calculations in code
             +--> optional independent council review
             +--> bounded evidence lookup
                         |
                         v
               source-linked proposals, accepted or dismissed by the user
~~~

Keep raw audio local only when local STT is selected. Cloud STT sends audio to its provider; Nebius reasoning receives the transcript and relevant graph context. Do not market the cloud configuration as fully on-device or offline.

### 8.2 Classifier agent: useful role and important limit

Reasoning effort is selected before an inference request. A classifier cannot change the effort of the request already generating its classification.

Three alternatives should be compared:

| Routing strategy | Benefit | Cost / limitation |
|---|---|---|
| Known-action rules | Instant: mapping, numeric calculations, user Stress-test and scenario requests are already distinct actions | Cannot infer every subtle situation |
| Extraction plus review recommendation in the same output | No extra preflight round trip | Can only request a subsequent deeper pass; its silence does not certify sound reasoning |
| Separate cheap classifier | May cheaply route high-volume repetitive requests | Adds a serial call if awaited; can miss important subtle arguments |

Start with the first two. Introduce a separate classifier only after measuring cost/latency saved and important reviews missed. Compare against always-light plus user-requested deep review. An embedding model alone is not a complete zero-shot reasoning router.

Never use a lightweight classifier's confidence as proof of logical validity. Explicit user requests, failed schema validation, detected stale state and hard constraint checks are enforced by code.

### 8.3 State and provenance

Proposed core entities:

| Entity | Required fields / behavior |
|---|---|
| Transcript segment | session ID, provider item ID, revision, text, partial/final state, user-corrected version |
| Thought node | stable ID, kind, text, original quote/span, origin, lifecycle status |
| Relation | stable endpoints, relation type, source, AI-inferred versus user-confirmed status |
| Preference / criterion | user-stated meaning, scale, weight if explicitly provided |
| Ghost proposal | affected nodes, reason, source spans, AI origin, offered/accepted/edited/dismissed state |
| Evidence | URL/file, excerpt, retrieval time, claim relation, verification status |
| Scenario | option, horizon, assumptions, invented details, milestones, disconfirming signs |
| Analysis run | graph version, model ID, requested effort, actual usage, timings, status |

Distinguish a user-stated fact from an independently supported fact. Distinguish “the speaker sounded certain” from model confidence and from truth.

### 8.4 Reliability contracts

- Preserve stable node IDs; merge a restatement instead of duplicating it.
- Apply retractions and preference changes explicitly.
- Tag every result with transcript and graph versions. A slow analysis must not overwrite a corrected current graph.
- Allow independent branch patches only when their base versions and affected nodes still match; otherwise recompute or show the result as stale.
- Use one extraction request in flight per thread, with a newest-pending update, rather than an unbounded queue.
- Cancel superseded reads when possible; do not present cancellation as proof that provider billing stopped.
- Validate schemas, source-span bounds, referenced node IDs, duplicates and dangling edges before persistence.
- If JSON/schema behavior is unsupported or invalid, fail visibly and retain transcript input; at most one bounded repair for a read-only result.
- Keep fixtures and mock fallbacks visibly marked. Existing ThoughtPilot fallback code must not silently turn a failed live call into a “successful” demonstration.
- Store keys on the backend. Use the provider's supported temporary-browser credential flow when needed; do not embed permanent keys in the frontend.
- For OpenAI's documented live path, handle 24 kHz audio; the existing Maxmin capture path is 16 kHz. Audio adapters must resample/encode per provider rather than assuming one universal format.
- For a local speech server, bind to loopback, check the requesting origin and keep credentials outside the browser.
- Treat retrieved pages as evidence inputs, not instructions. Quote existence can be checked in code; whether the quote supports the claim still requires evaluation.

### 8.5 What “fallacy detection” should mean

| Category | Example | Appropriate response |
|---|---|---|
| Potential invalid inference | If a product is useful people use it; people use it; therefore they pay for it | Identify the exact inference and explain why the conclusion may not follow |
| Unsupported premise | Students will pay £8 | Ask for evidence or propose a test; do not mark false merely because no source is attached |
| Preference | I value stability over prestige | Preserve it; research cannot refute a personal priority |
| Prediction | Judges will prefer a browser agent | Mark uncertain; surface assumptions and alternatives |
| Acoustic ambiguity | “can” versus “can't” is unclear | Ask to correct the transcript before critiquing |
| New information / changed mind | Earlier pay mattered most; now learning matters most | Record a revision; do not automatically label contradiction or inconsistency |

A natural-language map is not a formal proof or a causal model. For a formal-logic feature, the user must approve the formalization and understand what the solver actually checks. For scenario sensitivity, show model-generated outcomes as conditional proposals, not causal effects measured in the world.

## 9. Nebius reasoning and extraction models

### 9.1 Catalog coverage and selection

The live public catalog was queried directly on the research date. The following IDs and input/output prices were present; active catalog status is not proof that a particular hackathon key can call a serverless endpoint.

| Exact Nebius ID | Input / output USD per million tokens | Proposed role |
|---|---:|---|
| deepseek-ai/DeepSeek-V4.1-Flash-1017 | $0.30 / $1.20 | Primary quality engine; extraction challenger if a low-effort mode works |
| Qwen/Qwen3.8-27B | $0.45 / $3.00 | Fast extraction experiment with thinking disabled |
| Qwen/Qwen3-30B-A3B-Instruct-2507 | $0.10 / $0.30 | Explicit nonthinking, JSON-mode baseline |
| nvidia/Nemotron-3_5-Lightning | $0.06 / $0.24 | Low-cost routing/extraction experiment |
| zai-org/GLM-5.3-Flash | $0.15 / $0.50 | Distinct critic/defender model on explicit review |
| deepseek-ai/DeepSeek-V4-Flash-0731 | $0.14 / $0.28 | Catalog-tagged JSON-mode fallback, if task accuracy is adequate |
| MiniMaxAI/MiniMax-M3.1-Flash | $0.15 / $0.60 | Optional quality comparison; measured reasoning delay makes it a weak live-path choice |
| moonshotai/Kimi-K3 | $3.00 / $15.00 | Premium review experiment, not an automatic upgrade |
| reflection/beam | $0.25 / $1.00 | Catalog candidate only; insufficient independently measured endpoint evidence here |

Source: [Nebius model catalog](https://tokenfactory.nebius.com/api/public/models_info). The catalog also includes larger Qwen, DeepSeek Pro, GLM and other models, but breadth alone is not a reason to add them to a six-hour comparison. Cache discounts are excluded from the conservative cost estimates.

### 9.2 Independent endpoint measurements

These are published Artificial Analysis measurements, not local runs. Values are approximate snapshots of rolling provider benchmarks. They use a 10k-token input and, for end-to-end time, a 500-token answer. The reasoning settings, quantization and endpoint must match before comparing.

| Model / measured setting | Nebius output rate | First chunk | Approximate 500-token answer time | Interpretation |
|---|---:|---:|---:|---|
| [DeepSeek 1017, max](https://artificialanalysis.ai/models/deepseek-v4-1-flash-1017/providers) | 391 tokens/s | 1.49 s | 7.88 s, including 5.11 s reasoning | Strong quality-engine candidate; 391 tokens/s does not imply an instant useful answer |
| [Qwen3.8-27B, xhigh](https://artificialanalysis.ai/leaderboards/providers) | 414 tokens/s | 1.36 s | 7.41 s, including 4.83 s reasoning | Not a measurement with thinking disabled |
| [Qwen3 30B A3B Instruct, nonthinking](https://artificialanalysis.ai/models/qwen3-30b-a3b-2507/providers) | About 33–39 tokens/s across retrieved snapshots | 1.18 s | About 16.39 s at the 33-token/s snapshot | Only plausible for short output; JSON capability does not guarantee extraction quality |
| [Nemotron 3.5 Lightning, reasoning](https://artificialanalysis.ai/models/nemotron-3-5-lightning/providers) | About 250–270 tokens/s | About 1.0–1.15 s | About 10.4–11.2 s | Do not treat reasoning-mode figures as nonthinking performance |
| [DeepSeek V4 Flash 0731](https://artificialanalysis.ai/models/deepseek-v4-flash/providers) | 230 tokens/s | 1.63 s | 12.51 s | Cheaper, but not the latency leader in this comparison |
| [GLM-5.3-Flash](https://artificialanalysis.ai/leaderboards/providers) | 157 tokens/s | 1.55 s | 17.46 s | Optional background critic |
| [Kimi K3, max](https://artificialanalysis.ai/models/kimi-k3/providers) | 183 tokens/s | 1.53 s | 15.18 s | Expensive review option with no demonstrated task-specific advantage |
| [MiniMax M3.1 Flash](https://artificialanalysis.ai/models/minimax-m3-1-flash/providers) | 72 tokens/s | 1.75 s | 36.69 s | Low token price does not make it a low-latency engine |

AA's general intelligence indices in the inspected pages favored DeepSeek 1017 over several cheaper candidates, but those aggregate tests do not establish performance on the app's claims, graph edges or blind spots. The nonthinking Qwen3 baseline has much weaker general capability; it must pass a faithful-extraction test before becoming the default.

The user's approximate 200-token/s number is consistent with a different provider measurement, such as the first-party DeepSeek API. It is not a measurement of this app or the Nebius endpoint. The catalog's 738-token/s field for 1017 has no established workload methodology in that response; do not substitute it for the independent measurements.

### 9.3 Reasoning and structured-output controls

The [DeepSeek direct API](https://api-docs.deepseek.com/api/create-chat-completion/) and [thinking guide](https://api-docs.deepseek.com/guides/thinking_mode/) document none/low/high/max reasoning effort. This does not verify that Nebius accepts those exact controls or gives the same latency behavior.

The [Qwen3.8 card](https://huggingface.co/Qwen/Qwen3.8-27B) documents disabling thinking through enable_thinking in chat-template settings. [NVIDIA's Lightning card](https://catalog.ngc.nvidia.com/orgs/nim/nvidia/models/nemotron-3.5-lightning/hf-3db7814) also documents thinking controls. Passing those settings through Nebius is unverified. A silently ignored switch would invalidate a claimed fast path.

[Nebius JSON documentation](https://docs.tokenfactory.nebius.com/ai-models-inference/json) uses model tags to indicate support. In the retrieved catalog, Qwen3 Instruct and DeepSeek 0731 were JSON-tagged, while 1017, Qwen3.8 and GLM-5.3-Flash were not. Missing tags are an evidence gap, not proof of impossibility. Function calling, JSON mode and strict JSON Schema are different capabilities. Valid JSON also does not guarantee valid node references or faithful extraction.

Direct DeepSeek documents restrictions on forcing named/required tool choices in thinking mode. Do not assume a forced-tool workaround works identically on Nebius. Confirm the exact request/response shape during the first implementation smoke check.

### 9.4 Concrete allocation by feature

| Feature | Proposed request | Output budget and quality gate |
|---|---|---|
| Graph update | Qwen3.8 nonthinking if supported; compare with 1017 lower effort and short-output Qwen3 Instruct | Small incremental patch, normally 150–400 answer tokens; preserve negation, source spans and existing IDs |
| Review recommendation | A field in the same extraction result | Small bounded enum plus reason; no authority to certify validity |
| Ghost/blind spot | 1017, high or max effort if Nebius supports the control | One or two grounded proposals; 300–700 answer tokens; no forced criticism |
| Parallel Lives | One 1017 request producing two or three comparable short branches | Approximately 800–1,200 answer tokens; assumptions and invented details explicit |
| Trade-off explanation | 1017 explains code-computed comparisons and unknowns | Approximately 200–500 answer tokens; never generate the arithmetic result independently |
| Council | Parallel 1017 critic and GLM defender, optionally a separate evidence reviewer; then one bounded synthesis | Explicit action only; short role outputs, preserve disagreements; avoid repeated debate rounds |
| Evidence synthesis | 1017 over selected excerpts with stable source IDs | Quote/URL verification, source relevance and claim relation checked separately |
| Final decision record | 1017 summarizes the accepted graph | Attribute user choices, AI proposals, rejected options and unresolved assumptions |

Budgets are proposed answer lengths, not proof that total generated usage is bounded to the same amount. Reasoning tokens and provider-specific token-limit behavior must be measured and included in billing.

## 10. Cost model and latency targets

### 10.1 Representative active user-hour

Two illustrative workloads, not observed usage:

| Workload | Calls / token assumption | Total input | Total generated output |
|---|---|---:|---:|
| Bounded | 36 updates at 800/150 input/output; 8 analyses at 4,000/900; 2 syntheses at 8,000/1,500 | 76,800 | 15,600 |
| Busy | 100 updates at 2,000/250; 20 analyses at 10,000/2,000; 10 critiques at 6,000/1,500; one synthesis at 20,000/3,000 | 480,000 | 83,000 |

For costing, generated output includes reasoning. If actual reasoning exceeds this allowance, these estimates increase. All input is treated as uncached, and all text work is priced at DeepSeek 1017's catalog rate, rather than assuming discounting.

Text inference cost = input tokens × $0.30 / 1,000,000 + generated tokens × $1.20 / 1,000,000.

| Speech configuration | Bounded total / hour | Busy total / hour | Comment |
|---|---:|---:|---|
| Local STT + local/no TTS | $0.042 | $0.244 | Excludes laptop power, hosting and setup |
| Soniox at approximately $0.12/hour | $0.162 | $0.364 | Context and actual metering may add cost |
| Muse at $0.18/hour | $0.222 | $0.424 | Audio processed, not an assumed idle-hour charge |
| Grok at $0.20/hour | $0.242 | $0.444 | Silence/session metering unresolved |
| Nova-3 current promo $0.288/hour | $0.330 | $0.532 | Regular-rate risk remains |
| Scribe v2 Realtime base $0.39/hour | $0.432 | $0.634 | Keyterm and plan charges excluded |
| GPT Transcribe at $0.27/hour | $0.312 | $0.514 | Recorded or committed-turn workflow, not identical UX |
| GPT Live Transcribe at $1.02/hour | $1.062 | $1.264 | Over a strict $1/hour combined target |

These calculations assume 60 billed audio minutes. For actual-audio billing, a user who speaks for only 20 minutes may spend less; for session-duration billing, silence may still count. Do not mix these billing bases without recording them.

MAI and Cartesia are omitted from the cost totals because this research did not establish a usable current numeric quote for the intended account/configuration.

The $200 Token Factory balance covers eligible Nebius usage, not external STT invoices. The per-hour estimates above are underlying list-price economics, even while credits cover the Nebius portion. Additional cloud TTS, web-search APIs, browser infrastructure and app hosting are excluded. No live invoice or account eligibility was checked.

Useful controls: display actual model usage, cap deep passes per user-hour, cap context by graph neighborhood, include reasoning tokens, cancel superseded requests, and close speech sessions when capture stops. A full ever-growing transcript sent on every audio update can make otherwise cheap inference unnecessarily slow and expensive.

### 10.2 Latency plan

Proposed acceptance targets, not provider promises:

| Stage | Initial target | What to do if it misses |
|---|---|---|
| Live captions | First useful partial during speech; assess cadence and corrections | Keep partial UI separate from permanent graph state |
| Speech end to stable final | Aim for P50 below 0.5 s and P95 below 1 s on the chosen test set | Tune endpointing only while preserving corrections and pauses |
| Stable transcript to first valid patch | Aim for P50 below 2.5 s, P95 below 5 s for short turns | Test nonthinking extraction, shorten context/output or switch model; do not lower quality requirements silently |
| Ghost proposal | Useful first card within roughly 5–10 s | Show explicit progress; allow cancellation; avoid blocking continued speech |
| Parallel scenarios / council | Background result in roughly 10–30 s, depending on scope | Bound branches and role outputs; return partial role results only with clear pending status |
| UI acknowledgement | Immediate visible state change on mic, submit or analysis action | Fix locally; model latency should not delay acknowledging the click |

These targets can fail with the currently published max-reasoning timings. That is precisely why the first implementation task must measure real short-turn requests and actual thinking controls. Parallelizing a council changes elapsed time to roughly the slowest role plus synthesis, not the sum of all role times; it does not eliminate the tail.

Report P50/P95, cold versus warm runs, network/region, exact model ID, requested settings, input/output/reasoning counts and time to a valid rendered result. A 20-sample P95 is only a rough tail indication; do not present it as a production SLA.

## 11. Existing code and portfolio research

### 11.1 Strongest reusable foundations

| Asset | What source inspection established | Proposed reuse and limits |
|---|---|---|
| [Maxmin schema](<C:/Users/aksha/Desktop/GitHub/Maxmin-Assistant/src/lib/schema.ts:14>) | Thought kinds, typed relations, verbatim text, lifecycle state, origin, merges and retractions exist | Best semantic foundation. Its certainty field records hedging, not truth |
| [Maxmin extraction route](<C:/Users/aksha/Desktop/GitHub/Maxmin-Assistant/src/app/api/extract/route.ts:1>) | Audio/text input, Gemini extraction, persistence and incremental placement code exist | Separate speech recognition from semantic extraction; replacing the LLM URL does not replace audio ingestion |
| [Maxmin Plan](<C:/Users/aksha/Desktop/GitHub/Maxmin-Assistant/Plan.md:310>) | Deeper challenges, grounding, stuck detection and richer records are planned | Do not describe those future phases as already implemented |
| [ThoughtPilot](<C:/Users/aksha/Desktop/Hackathons/Tech-Europe-Hackathon/README.md:11>) | Visual graph, challenge/research commands, graph patches, citations and export concepts | Useful UI/patch patterns, but the broad idea already existed in the user's portfolio |
| [ThoughtPilot refine route](<C:/Users/aksha/Desktop/Hackathons/Tech-Europe-Hackathon/server/src/routes/refine.ts:24>) | Research/model mock fallbacks and sanitization are explicit | Preserve honest live-versus-fixture status if reusing |
| [Jev architecture](<C:/Users/aksha/Desktop/GitHub/JEV/My Projects/jev-ultrafast/docs/architecture.md:1>) | Indexed action loop and independent assertion/readback design exist; live demo status is qualified | Useful bounded evidence investigation, not required for every search |
| [README vs Reality](<C:/Users/aksha/Desktop/Hackathons/Moonfire Hackathon/moonfire-hackathon/README.md:37>) | Evidence links, quote checks and code-computed scoring are central patterns | Reuse evidence presentation and validation ideas, not an arbitrary decision-quality score |

Maxmin's README says it is unimplemented, but actual source and tests exist. The README is stale relative to source presence; successful current runtime behavior remains unverified. Its original passive-mirror contract is narrower than this proposed product. This plan is a proposed evolution in the new hackathon repository, not permission to overwrite the sibling application's contract.

Do not copy entire projects or their local environment files. Inspect licenses, preserve WIP, isolate the build, and confirm the hackathon's existing-code policy before claiming work as newly built. No source was copied by this research.

### 11.2 Hackathons folder coverage

All 15 immediate folders were considered, including the current repository. The earlier Luna survey inspected project roots, documentation and selected source; this is not an exhaustive runtime audit.

| Folder / project | Finding and relevance |
|---|---|
| Agentic AI Hackathon Tech Europe / NightWatch | Existing incident/recovery agent using Jev, generated candidates, isolated worlds and trusted checks. Good evidence/testing patterns; not a fresh generic-browser-agent pitch |
| AI Ventures Hackathon Imperial / UnDiffused-AI | Substantial image-authenticity extension. Separate from the decision workspace; do not infer abandonment from checkout state |
| Claude Hackathon Imperial / Medi-Scribe | Adaptive symptom-history interview and timeline. Interview structure is relevant; medical application is unnecessary scope here |
| Claude Hacks Imperial / Avalon | Nuclear-analysis data, scripts, charts and ML report. Analysis bundle, not a speech/decision product foundation |
| DSS Finance Project | Congressional-trading pipeline and analysis; audit records incomplete committee-data coverage. Concrete unfinished data work, weak fit to this product |
| F1-RearWing-AeroFlow | Aerodynamics/optimization project with local changes. Specialized data and claims require separate validation |
| Google-A2UI Hackathon / PeerReview.ai | Human-approved marking cockpit with deterministic evidence and generated review UI; legal example documented as a stub |
| GoogleHackathon | Canvas-based AI tutor code. Useful structured-canvas pattern; not the selected user problem |
| Great Agent Hackathon 2025 / CalPilot.ai | Calendar agent, metrics and benchmark assets; maps integration explicitly unfinished/not shown wired in |
| Hack London KCL / StudyCanvas | Mature study product with source-linked canvas and voice workflows. Broad separate application; preserve its active work |
| Moonfire Hackathon / README vs Reality | Repository-evidence product and evaluator; documented GitHub provider gap. Strong evidence UX reference |
| Nebius-Imperial-Hackathon | Root initially contained only README and Git metadata. This plan is the only new deliverable from the current request |
| Rockstar Games Datathon Dataset | Player data, Python analysis and plots; no declared app backlog found |
| Tech-Europe-Hackathon / ThoughtPilot | Closest previous visual thinking product; challenge/research/build-spec flows already described |
| WIF Hackathon / Moneywell Town | Shipped financial-literacy game; its client-only/no-API contract conflicts with making hosted inference central |

### 11.3 GitHub folder coverage

All 19 immediate folders were considered, including nested JEV and TESTING projects. Status means what was found in source/docs, not that an app was executed.

| Folder / family | Finding and relevance |
|---|---|
| AkshayReddyGujjula | Portfolio/profile site. Some summary claims require reconciliation with project benchmark reports |
| CS-project | Older stock-predictor learning/project materials; weak product foundation |
| JEV | Jev Ultrafast, JevQuant, Dipper Live, six quant-muse work folders and documentation-only jev-knowledge. Quant folders are not evidence of completed trading performance |
| Maxmin-Assistant | Strongest direct reuse: reasoning-map source, audio/text capture, persistence and tests; deeper challenge features not established as implemented |
| muse-app | Launcher rather than a fresh end-user product |
| Omp App | Windows launcher/tooling |
| OMP Maintenance 2026-10-07 | Local configuration/maintenance work, not a standalone hackathon concept |
| opencode-app | Launcher/tooling |
| Opencode-RemoteControl | Substantial phone PWA, companion and Android wrapper; roadmap/docs may lag code; integration-heavy |
| PI Deepseek Optimisation | Isolated Pi runtime/profile and tracing/benchmark tooling; provider aliases do not prove Nebius settings or a speed advantage |
| Pi-app | Windows launcher with separate runtime identity considerations |
| RayNeo-Spatial | AR multi-monitor application; requires specific hardware, weak general judging fit |
| SecureShareVault | Desktop sharing/security project, outside the selected problem |
| STT App / Murmur | Native voice-to-Claude companion. Useful microphone interaction lessons, but coupled to Claude rather than a generic ASR service |
| StudyCanvas-Public | Public engineering documentation; do not assume the private application source is present there |
| TESTING | Cricket biomechanics prototype and a separate Android mantra counter; domain-specific |
| tools | Tooling/package infrastructure and a VertoXR binary |
| UnDiffused-AI | Mature local image detection project; C2PA listed as incomplete. Image benchmarks were not rerun |
| vasmio.com | Company/marketing site rather than a decision-engine foundation |

No project was classified as abandoned merely because it was incomplete, old, dirty or a work-folder snapshot. Source presence, README claims and runtime readiness were kept separate.

## 12. Six-hour implementation proposal

This is a future execution plan, not a record of work performed. Agent coding throughput can produce substantial functionality; the difficult dependency is verifying the model/audio behavior early enough to avoid building around an unsupported path.

| Time | Builder A: backend/model/data lane | Builder B: interface/audio lane | Integration checkpoint |
|---|---|---|---|
| 0:00–0:30 | Verify account model IDs, effort controls, JSON behavior and actual token usage with a few bounded requests | Verify two speech APIs or one local model; record real mic input | Pick a working speech path and a quality-passing extractor |
| 0:30–1:30 | Transcript/graph schema, persistence, patch validation, versioning | Capture, provisional captions, transcript editor, readable graph | One live thought produces a persistent, source-linked map |
| 1:30–2:30 | Blind-spot request, evidence/source-span checks, acceptance lifecycle | Ghost rendering, inspect/add/edit/dismiss, request progress | User accepts or rejects one useful suggestion |
| 2:30–3:30 | Explicit criteria, constraints and code-computed trade-offs | Comparison view, priority editing, affected-branch highlighting | Changing a declared input changes the comparison transparently |
| 3:30–4:30 | Conditional scenarios; optional bounded council only if core is stable | Parallel Lives branch view; short scenario cards; optional requested speech | Same graph powers the extra view without losing attribution |
| 4:30–5:15 | Model/audio evaluation, failure paths, actual usage and latency logging | Keyboard/mic/error/reload flows and visible fixture labeling | Fix meaning-changing errors before visual extras |
| 5:15–6:00 | Bounded evidence lookup or model comparison if needed; save a reproducible demo record | Polish the chosen narrative, controls and fallback state | Rehearse live, verify fallback, record exact remaining limitations |

If parallel coding agents are used, follow the user's ownership rule: create isolated worktree branches first, one worker per worktree, and integrate deliberately. Keep this repository's new work separate from unrelated sibling WIP. No branch, worktree, commit or push was created in the research task.

Suggested stack: reuse the familiar TypeScript/React/React Flow/Zustand patterns, a small backend for credentials/model calls, and SQLite or an equivalent simple local store. Use a local speech companion only if the chosen ASR runtime requires it. A vector database, general agent framework or broad cloud infrastructure is not needed for a single decision thread.

## 13. Evaluation and acceptance plan

### 13.1 Compare models by feature, not one aggregate winner

| Feature | Meaningful evaluation |
|---|---|
| STT | Verbatim WER plus separately recorded negation, numbers, names, correction loss, hallucination in silence, endpoint splitting, backlog and finalization latency |
| Graph extraction | Faithful thought units, supported edges, correct references, merges/retractions, preference/fact separation, schema-valid patch rate |
| Ghost/blind spot | Useful overlooked issue, quote grounding, nonredundancy, respectful charitable interpretation, false criticism on clean controls |
| Parallel Lives | Assumptions explicit, no invented facts passed as evidence, sensible range of outcomes, useful reversible experiment, no prediction percentage |
| Trade-offs | Correct arithmetic, preserved hard constraints, transparent scales, missing data not treated as zero, unchanged inputs reproducible in code |
| Council | Improvement over one well-prompted model at a comparable token/time budget; disagreements preserved; no consensus-as-truth |
| Retrieval | Source actually exists, excerpt present, claim-to-evidence relation judged separately, stale/contradictory evidence surfaced |
| Full application | Time to useful rendered result, revision correctness, cancellation, reconnect, saved state and honest fallback behavior |

Use both builders as reviewers on a small fixed set, compare disagreements and retain examples. This provides useful engineering evidence, not a study proving improved decisions.

### 13.2 Required controls and failure scenarios

1. Clean reasoning: the system can return no useful challenge instead of manufacturing a flaw.
2. Negation pair: “I can accept a pay cut” versus “I can't accept a pay cut.”
3. Cross-turn revision: the second utterance retracts the first; old analysis cannot overwrite it.
4. Ambiguous preference: ask whether a criterion matters instead of inventing its weight.
5. Unsupported premise: no attached evidence does not mean false.
6. Changed circumstances: a different decision after new information is not automatically hypocrisy.
7. False binary: suggest a third option only if genuinely relevant and clearly AI-generated.
8. Sunk-cost candidate: distinguish emotional attachment from reusable work that reduces future cost.
9. Proper names and amounts: preserve company names, model IDs, £8 versus £80 and dates.
10. Silence/noise: no invented transcript or unsolicited analysis.
11. Stale council: roles finish after a graph edit; show their old result as stale or discard it.
12. Explicit override: a low-priority classifier recommendation cannot suppress Stress-test.
13. Unknown trade-off cell: do not rank it as zero.
14. Provider failure: transcript survives, model failure is visible, mocks are labeled.
15. Reload/reconnect: user edits and accepted proposals remain, with no double application.
16. TTS interruption: user speech stops playback without being re-ingested as a new human statement.

For browser-based implementation tests, use the user's Jev MCP workflow and page-read assertions. If Chrome is unreachable or a run stalls, report that gap rather than silently testing another browser engine.

### 13.3 First benchmark decision gate

Before committing to the full build, run a small actual-account comparison:

- two cloud speech finalists on the same real-time-paced clips, with a local candidate if readily available;
- Qwen3.8 without thinking if supported, DeepSeek 1017 lower effort if supported, and one documented JSON baseline on identical short transcript/graph inputs;
- one clean argument and one difficult correction per candidate before optimizing throughput;
- a small output cap versus a long output cap to reveal whether answer size or reasoning dominates;
- the exact accepted model/setting, actual usage, first answer and valid-patch timings recorded.

Choose the model that passes the quality floor and meets the interaction target. If no extractor meets the target, use a user-submitted thought or pause-to-process interaction and describe it honestly. Do not claim continuously instant reasoning simply because live captions are instant.

## 14. Demonstration narrative

Use a low-stakes, concrete decision such as choosing between two project directions or internship offers. All example facts should be provided as inputs, supplied from actual sources, or clearly marked fictional.

1. Speak for 20–30 seconds. Show provisional captions, then an editable committed transcript.
2. Show the map with transcript-backed user points, AI-inferred links and unknowns visibly different.
3. Open Blind Spot. It surfaces one missing question rather than a lecture.
4. Accept, edit or reject the ghost. Show that the user's graph changes only deliberately.
5. Change one user-supplied priority. The visual trade-off changes with inspectable arithmetic or qualitative dependencies.
6. Open Parallel Lives for a selected option. Show conditional scenarios and the assumptions behind them.
7. Optional: ask the council to challenge one assumption; preserve disagreement.
8. Close with a decision record: what the user chose, why, what is unresolved and what to test next.

The strongest moment is not agents announcing completion. It is a user saying “Actually, that assumption is wrong,” followed by the correct graph and comparison visibly updating.

## 15. Open questions and honest completion criteria

The plan is complete as research. Implementation remains contingent on:

- exact Nebius account availability, reasoning controls and structured-output behavior;
- actual speech accuracy and latency on this microphone/accent/network;
- local runtime performance on the 258V/Arc machine;
- external STT account access, minimum plans, metering and regional settings;
- Azure preview access and numeric MAI pricing if that candidate is selected;
- which AssemblyAI identifier/default is current for the selected account;
- actual generated reasoning usage and how the provider reports/bills it;
- event rules on two-person teams and prior code reuse;
- source licenses and a deliberately chosen implementation baseline;
- whether the Blind Spot, scenario and council outputs pass the clean-control and revision tests.

No public benchmark or model vote establishes that the application improves a person's reasoning or predicts their future. The deliverable should make a narrower, demonstrable claim: **it faithfully captures stated reasoning, separates suggestions from user beliefs, and lets users inspect how assumptions and priorities affect a decision.**
