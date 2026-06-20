export const SAMPLES = {
  password_validator: {
    label: "password_validator.py",
    code: `def validate_password(password):
    """Returns (is_valid, reason) for a password policy check."""
    if len(password) < 8:
        return False, "too short"
    if not any(c.isupper() for c in password):
        return False, "missing uppercase"
    if not any(c.isdigit() for c in password):
        return False, "missing digit"
    return True, "ok"


def calculate_strength_score(password):
    """Returns an integer 0-100 strength score."""
    score = 0
    score += min(len(password) * 4, 40)
    if any(c.isupper() for c in password):
        score += 20
    if any(c.islower() for c in password):
        score += 20
    if any(c.isdigit() for c in password):
        score += 10
    if any(not c.isalnum() for c in password):
        score += 10
    return min(score, 100)
`,
    existingTests: `from solution import *

def test_valid_password():
    valid, reason = validate_password("Abcdef12")
    assert valid is True

def test_too_short():
    valid, reason = validate_password("Ab1")
    assert valid is False
    assert reason == "too short"
`,
  },

  rate_limiter: {
    label: "rate_limiter.py",
    code: `import time


class RateLimiter:
    """Simple fixed-window rate limiter."""

    def __init__(self, max_requests, window_seconds):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = {}

    def allow(self, client_id):
        now = time.time()
        window_start = now - self.window_seconds
        history = self.requests.get(client_id, [])
        history = [t for t in history if t > window_start]
        if len(history) >= self.max_requests:
            self.requests[client_id] = history
            return False
        history.append(now)
        self.requests[client_id] = history
        return True

    def reset(self, client_id):
        self.requests.pop(client_id, None)
`,
    existingTests: "",
  },

  empty: {
    label: "blank",
    code: "",
    existingTests: "",
  },
};
