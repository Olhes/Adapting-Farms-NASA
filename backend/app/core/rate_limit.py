"""Small in-process, per-client sliding-window rate limit. It lives in one process only: with several workers each one
counts on its own, which is fine for a single-instance deploy and a soft cost guard."""
import math
import threading
import time
from collections import OrderedDict, deque

from fastapi import HTTPException, Request

from app.core.config import settings


class RateLimiter:
    def __init__(self, limit: int, window: float = 60.0, max_clients: int = 10_000, clock=time.monotonic):
        self.limit, self.window, self.max_clients, self._clock = limit, window, max_clients, clock
        self._hits: OrderedDict[str, deque] = OrderedDict()
        self._lock = threading.Lock()

    def check(self, client: str) -> float | None:
        """Register a request. Returns None when it is allowed, else the seconds until the client may try again."""
        now = self._clock()
        with self._lock:
            hits = self._hits.get(client)
            if hits is None:
                hits = self._hits[client] = deque()
            while hits and now - hits[0] >= self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                return max(self.window - (now - hits[0]), 0.0)
            hits.append(now)
            self._trim()
            return None

    def _trim(self) -> None:
        """Keep memory bounded: drop clients whose window has passed, then the oldest-seen ones."""
        if len(self._hits) <= self.max_clients:
            return
        now = self._clock()
        for key in [k for k, h in self._hits.items() if not h or now - h[-1] >= self.window]:
            del self._hits[key]
        while len(self._hits) > self.max_clients:
            self._hits.popitem(last=False)

    def tracked(self) -> int:
        return len(self._hits)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


def client_id(request: Request) -> str:
    if settings.trust_forwarded_for:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",")[-1].strip()   # the address the trusted proxy appended, not what the client claims
    return request.client.host if request.client else "unknown"


explain_limiter = RateLimiter(settings.explain_rate_limit_per_minute)


def explain_rate_limit(request: Request) -> None:
    """Route dependency for /explain."""
    wait = explain_limiter.check(client_id(request))
    if wait is not None:
        seconds = max(1, math.ceil(wait))
        raise HTTPException(status_code=429, detail=f"Too many explanation requests; try again in {seconds} s.",
                            headers={"Retry-After": str(seconds)})
