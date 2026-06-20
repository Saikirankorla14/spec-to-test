# spec→test
<img width="1917" height="965" alt="image" src="https://github.com/user-attachments/assets/812c97ca-ac32-4be3-85a5-ad28d20429a9" />


**Paste a Python function. Get an adversarial pytest suite. Watch it actually run.**

This isn't an LLM-wraps-an-API toy. The interesting engineering problem here isn't "call an
LLM and show the text" — it's **trusting nothing the model says**. An LLM will happily claim
its tests pass, claim 100% coverage, and hallucinate a clean bill of health. This tool never
takes its word for it: every generated test is executed in a real, sandboxed `pytest` +
`coverage.py` run, and the report is built from that execution, not from the model's commentary.

## What it does

1. You paste a Python function/class (and optionally your existing pytest suite).
2. Groq (Llama 3.3 70B) drafts a pytest file targeting edge cases: boundaries, type confusion,
   empty/null inputs, off-by-ones, unicode, negative numbers, floating-point precision.
3. The backend writes that code to an isolated temp directory and **actually runs it** —
   `python -m coverage run -m pytest`, with a syntax-check pass first so a malformed
   generation fails loud instead of silently.
4. If you supplied existing tests, it runs them alone first (baseline coverage), then runs
   existing + generated together, and diffs the two coverage reports to show exactly which
   lines your original suite was *not* exercising and which of those the new tests closed.
5. A second, smaller LLM call explains the still-uncovered lines in plain English.

## Why this is a meaningful portfolio project

- **It doesn't trust the LLM.** The hard part of "AI writes tests" isn't the prompt, it's
  verifying the output. This project treats LLM output as an *untrusted draft* that has to
  survive a syntax check, a real interpreter, and a real coverage tool before any claim about
  it reaches the UI.
- **Real coverage diffing, not vibes.** `gapAnalysis.js` does a structural diff between two
  `coverage.py` JSON reports — the same data format real CI tooling uses — to compute
  newly-covered vs. still-uncovered line sets.
- **Sandboxing matters.** Generated code runs in a throwaway temp directory with a 20s
  execution timeout, so a generated infinite loop or `os.system` call doesn't take down the
  process running it.
- **Failure paths are first-class.** A generated test file with a syntax error doesn't crash
  the backend — it's caught at `py_compile` time and surfaced to the user with the exact
  Python traceback.

## Architecture

```
client/   React + Vite frontend (dark "diagnostic lab" UI, CodeMirror editors)
server/   Node/Express backend
  groqClient.js     Prompt construction + Groq API calls (test generation, gap explanation)
  testRunner.js     Sandboxed pytest + coverage.py execution, JUnit XML parsing
  gapAnalysis.js    Diffs baseline vs combined coverage reports
  index.js          Express routes tying it together
```

### Request flow for the main action (`POST /api/full-pipeline`)

```
code, existingTests
   │
   ├─► (if existingTests) run existing tests alone ──► baseline coverage
   │
   ├─► Groq: generate edge-case pytest file
   │
   ├─► run existingTests + generated together ──► combined coverage
   │
   ├─► diff baseline vs combined ──► newly-covered / still-uncovered line sets
   │
   └─► Groq: explain still-uncovered lines in plain English
```

## Running it locally

**Requirements:** Node 18+, Python 3.10+ with `pytest` and `coverage` installed, a free
[Groq API key](https://console.groq.com/keys).

```bash
# 1. Python deps (used by the sandboxed test runner, not the Node server itself)
pip install pytest coverage --break-system-packages   # or use a venv

# 2. Backend
cd server
npm install
cp .env.example .env
# edit .env and paste your GROQ_API_KEY
npm start              # listens on :3001

# 3. Frontend (new terminal)
cd client
npm install
npm run dev             # listens on :5173, proxies /api to :3001
```

Open `http://localhost:5173`. Two example modules are preloaded under "load example" so you
can see it work immediately without writing anything.

## What I'd build next

- Persist runs (currently everything is in-memory/ephemeral per request) so you can compare
  coverage trends across commits.
- Mutation testing as a second signal: don't just measure line coverage, measure whether the
  generated tests actually *fail* when a line is mutated.
- Language-agnostic mode: the LLM prompt and sandbox runner are Python/pytest-specific by
  design (to keep the execution trust story tight), but the architecture generalizes to
  Jest/TypeScript with a swapped runner module.

## Stack

React · Vite · CodeMirror · Express · Groq SDK (Llama 3.3 70B) · pytest · coverage.py
