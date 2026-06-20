const BASE = "/api";

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export function checkHealth() {
  return request("/health");
}

export function runFullPipeline({ code, existingTests, specType }) {
  return request("/full-pipeline", {
    method: "POST",
    body: JSON.stringify({ code, existingTests, specType }),
  });
}

export function generateTests({ code, existingTests, specType }) {
  return request("/generate", {
    method: "POST",
    body: JSON.stringify({ code, existingTests, specType }),
  });
}

export function runTests({ solutionCode, testCode }) {
  return request("/run", {
    method: "POST",
    body: JSON.stringify({ solutionCode, testCode }),
  });
}
