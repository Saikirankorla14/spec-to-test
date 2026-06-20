import Groq from "groq-sdk";

let client = null;

function getClient() {
  if (!client) {
    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === "your_groq_api_key_here") {
      const err = new Error(
        "GROQ_API_KEY is not set. Copy server/.env.example to server/.env and add your key from https://console.groq.com/keys"
      );
      err.code = "MISSING_API_KEY";
      throw err;
    }
    client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return client;
}

const SYSTEM_PROMPT = `You are a senior test engineer specializing in adversarial edge-case discovery for Python code.

Given a Python module (function(s), class(es), or a description of an HTTP API), you generate a pytest test file that aggressively probes for bugs: boundary values, type confusion, empty/null inputs, off-by-one errors, unicode and encoding issues, negative numbers, floating point precision, concurrency-unsafe assumptions, resource exhaustion, malformed input, and any domain-specific edge cases implied by the code's purpose.

Rules you MUST follow:
1. Output ONLY a single Python code block containing the complete pytest test file. No prose before or after.
2. The test file must "import" the code under test using: "from solution import *" (the code under test will be saved as solution.py in the same directory).
3. Every test function must start with "test_" and use plain "assert" statements (pytest style), not unittest.TestCase.
4. Include a short one-line comment above each test explaining WHAT EDGE CASE it targets and WHY it matters (e.g. "# empty list should not raise IndexError on aggregation").
5. Prefer many small, focused tests over few large ones. Aim for 10-20 tests for a typical function, more for complex specs.
6. If given an OpenAPI/REST spec instead of code, generate tests against a hypothetical client function matching the spec's operationId or path, and note assumptions in comments.
7. Do not invent imports beyond pytest, the standard library, and "from solution import *". Do not assume hypothesis, requests, or other third-party libs are installed.
8. Do not write tests that are trivially true (e.g. "assert True"). Every test must exercise real behavior.
9. Group related tests with a comment header like "# --- boundary values ---" for readability.`;

function buildUserPrompt({ code, specType, existingTests }) {
  let prompt = "";

  if (specType === "openapi") {
    prompt += `The following is an OpenAPI/REST API specification (YAML or JSON). Generate pytest edge-case tests against a Python client for it, as described in your instructions:\n\n\`\`\`\n${code}\n\`\`\`\n`;
  } else {
    prompt += `Here is the Python code under test (this will be saved as solution.py):\n\n\`\`\`python\n${code}\n\`\`\`\n`;
  }

  if (existingTests && existingTests.trim().length > 0) {
    prompt += `\nThe user already has this existing test suite covering some cases. DO NOT repeat these tests. Focus only on edge cases NOT already covered below:\n\n\`\`\`python\n${existingTests}\n\`\`\`\n`;
  }

  prompt += `\nGenerate the complete pytest test file now, following all rules in your system instructions.`;
  return prompt;
}

export async function generateEdgeCaseTests({ code, specType = "python", existingTests = "" }) {
  const groq = getClient();
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  const completion = await groq.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt({ code, specType, existingTests }) },
    ],
    temperature: 0.4,
    max_tokens: 4000,
  });

  const raw = completion.choices?.[0]?.message?.content || "";
  return extractPythonCode(raw);
}

function extractPythonCode(text) {
  const fenced = text.match(/```(?:python)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // Fallback: model didn't fence it, return as-is
  return text.trim();
}

export async function explainGap({ uncoveredLines, code }) {
  const groq = getClient();
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  const completion = await groq.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a senior test engineer. Given source code and a list of line numbers that are NOT covered by any test, explain in 1-2 sentences PER LINE GROUP what behavior is untested and why it matters. Be terse and concrete. Output plain text, no markdown headers, just short bullet points starting with '- '.",
      },
      {
        role: "user",
        content: `Source code:\n\`\`\`python\n${code}\n\`\`\`\n\nUncovered line numbers: ${uncoveredLines.join(", ")}\n\nExplain the risk of each uncovered region briefly.`,
      },
    ],
    temperature: 0.3,
    max_tokens: 800,
  });

  return completion.choices?.[0]?.message?.content?.trim() || "";
}
