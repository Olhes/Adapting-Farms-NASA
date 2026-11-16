import pytest

from app.core import rate_limit


@pytest.fixture(autouse=True)
def fresh_rate_limiter():
    """The /explain limiter is process-wide state: every test starts with an empty one."""
    rate_limit.explain_limiter.reset()
    yield
    rate_limit.explain_limiter.reset()
