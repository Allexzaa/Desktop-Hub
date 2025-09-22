Goals

Let users choose model backends (local Llama server or external APIs).

Expose output controls for your two modes: AI Summary (comprehensive) and Fast Summary (concise).

Provide failsafe defaults, quick presets, and environment-safe secrets handling.

Information Architecture (Tabs)

Summaries

Models

Endpoints & Keys

Advanced

Usage & Logs (optional)

1) Summaries (per-mode presets + output format)

Sections

Mode Presets

AI Summary (comprehensive)

Temperature: 0.4

Top-p: 0.9

Top-k (if supported): 40

Max tokens: 1200

Repetition penalty: 1.05

Structure: Headings + bullets + key quotes

Include timestamps: On

Citations style: Inline [mm:ss]

Fast Summary (concise)

Temperature: 0.2

Top-p: 0.8

Top-k: 20

Max tokens: 300

Repetition penalty: 1.0

Structure: 3–5 bullets

Include timestamps: Off

Output Format

Format: Markdown | Plain text | JSON

Language: Auto | English | …

Bullet style: • | – | 1.

Include actionable tasks (detect “to-dos”): On/Off

Include key quotes/snippets: On/Off

Length guard: Soft | Strict (truncate at max tokens with ellipsis)

Stop/Schema (optional)

Stop sequences: []

JSON schema (if “JSON” selected): upload or paste schema

2) Models (selection + registry)

Active Model

Backend: Local Llama | External

Model (dropdown, from registry): e.g., llama-3.1-8B-instruct, mistral-nemo, gpt-4o-mini, etc.

Context window limit (read-only): from registry

Default mode mapping:

AI Summary → llama-3.1-8B-instruct

Fast Summary → llama-3.1-8B-instruct (or lighter model)

Model Registry (editable list)

Rows: Name | Provider | Model ID | Context | Default params override?

Add/Edit model dialog:

Name (friendly): Llama 8B Instruct

Provider: Local | OpenAI | Bedrock | Ollama | OpenRouter | Custom

Model ID / family: llama-3.1-8b-instruct

Context window: 8192

Default param overrides (optional): { "temperature": 0.3, "top_p": 0.9 }

Notes: free text

3) Endpoints & Keys (per provider)

Local

Base URL: http://localhost:11434/v1 (example)

Health check button

OpenAI / Compatible

Base URL

API key (masked)

Org/Project (optional)

Test call button

AWS Bedrock

Region

Credentials source: Env | Profile | Keys

Model ARN/ID

Test call button

Custom

Base URL

Auth header(s) template

Payload mapping (JSONPath/fields)

Security

Keys stored in OS keychain/credential vault if available; fallback to encrypted at rest (local keystore with app secret).

Never write keys to logs/config exports.

4) Advanced

Decoding defaults (applies unless overridden by Mode or Model):

Temperature, Top-p, Top-k, Max tokens, Repetition penalty, Presence/Frequency penalties

Determinism

Seed: Auto | Fixed

Rate limiting / timeouts

Request timeout (s): 30

Retry policy: retries=2, backoff=exp

Prompting

System prompt editor (with template vars: {video_title}, {channel}, {duration}, {lang})

Few-shot examples (array editor)

Safety/Filters

Profanity filter: On/Off

Sensitive topic disclaimers: On/Off

5) Usage & Logs (optional)

Last 50 requests: timestamp, mode, model, duration, tokens in/out

Export logs (PII-scrubbed)

Toggle verbose request/response logging (red banner warning)