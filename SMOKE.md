# Smoke results — 2026-10-24T12:04:41.695Z

| test | result | ms | ttft ms | reasoning tok | note |
|---|---|---|---|---|---|
| ds_effort_low | ok | 1046 | 926 | 76 | £0.05 |
| ds_effort_max | ok | 341 | 214 | 70 | £0.05 |
| ds_effort_low_hard | ok | 1613 | 404 | 748 | £68⅓ |
| ds_effort_max_hard | ok | 2381 | 285 | 1290 | £68⅓ |
| ds_json_object | ok | 510 | 450 | 12 | {"ok":true,"items":["a","b"]} |
| ds_tools_turn1 | ok | 279 | 216 | 0 | I'll search for the current population of Iceland.   |
| ds_tools_turn2 | ok | 477 | 386 | 11 |  |
| glm_summary_none | ok | 1091 | 472 | 40 |  |
| glm_summary_none_2 | ok | 1061 | 448 | 40 |  |
| glm_summary_none_3 | ok | 1340 | 708 | 36 | Weighing sleep |
| nemotron_summary_none | ok | 283 | 178 | 0 | Checking memory consolidation impact of one night sleep deprivation |
| minimax_audit | ok | 522 | 293 | 0 | {"contradictions":[{"a":"F1","b":"F2","severity":"direct","explanation":"F1 says |
| tavily_search | ok | 455 |  |  |  |
| elevenlabs_keyterms | ok | 363 |  |  |  |

**Effort control honoured (hard probe):** low = 748 reasoning tok / 1613 ms, max = 1290 reasoning tok / 2381 ms → YES
**Effort control honoured (easy puzzle):** low = 76 reasoning tok, max = 70 → NO / unclear
**Rate-limit headers seen:** {"x-ratelimit-dynamic-period-remaining":"773s","x-ratelimit-dynamic-period-usage-requests":"0%","x-ratelimit-dynamic-period-usage-tokens":"0%","x-ratelimit-dynamic-scale-requests":"1.00","x-ratelimit-dynamic-scale-tokens":"1.00","x-ratelimit-limit-requests":"1000","x-ratelimit-limit-tokens":"2000000","x-ratelimit-remaining-requests":"999","x-ratelimit-remaining-tokens":"1999456","x-ratelimit-reset-requests":"1s","x-ratelimit-reset-tokens":"1s"}
**ElevenLabs:** keyterms accepted

## Recommended .env
```dotenv
AGENT_MODE=tools
JSON_MODE=true
SUMMARY_MODEL=nvidia/Nemotron-3_5-Lightning
SUMMARY_EFFORT=none
```
## Notes across three smoke runs (12:02, 12:03, 12:04 UTC, 24 Oct 2026)

- **Effort is honoured, but only when there's something to think about.** On the easy bat-and-ball puzzle, low and max both used 28–76 reasoning tokens. On the multi-step bill problem, low used 606 and 748 tokens; max used 12,328 (17.9 s) on one run and 1,290 (2.4 s) on another. Max is honoured but varies a lot between runs. All effort levels gave the correct answer (£68.33).
- **Tools mode works.** DeepSeek 1017 + `tool_choice: "auto"` + `reasoning_content` echoed back in turn 2 → no 400s. Turn 1 reports 0 reasoning tokens when tools are present (it goes straight to a tool call). In turn 2 the model sometimes calls another search rather than `submit_findings`.
- **JSON mode works.** `response_format: json_object` was accepted on 1017 and returned valid JSON 3/3.
- **GLM-5.3-Flash is unreliable for summaries.** Even with `reasoning_effort: "none"`, it often spends the whole 40-token budget on hidden reasoning and returns an empty line: 3 empty out of 6 calls, plus 1 truncated ("Weighing sleep"). Latency was 1.1–1.9 s. **Nemotron-3_5-Lightning** returned a good line every time in 239–335 ms with 0 reasoning tokens, so it is now the summary model.
- **MiniMax-M3.1-Flash audit:** valid JSON 3/3, and it correctly flagged the planted F1/F2 pair as `direct`. Latency was 0.5 s, with one cold start of 9.3 s. Keep it as the audit model.
- **Tavily advanced:** 0.3–4.0 s, 5 results.
- **ElevenLabs scribe_v2:** the `keyterms` field (repeated form field) was accepted.
- **Rate limits are much higher than §5.5 assumed:** `x-ratelimit-limit-requests: 1000`, `x-ratelimit-limit-tokens: 2000000` (dynamic scale 1.00). The 50-starts/60 s window is very conservative; the integrator may raise it.
