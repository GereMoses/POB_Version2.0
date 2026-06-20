"""
ARIA uses a built-in knowledge engine — no external LLM required.
"""

def provider_info() -> dict:
    return {"provider": "ARIA Internal", "model": "knowledge-base", "free": True}


def get_async_client():
    raise RuntimeError("ARIA no longer uses an external LLM client.")


def get_sync_client():
    raise RuntimeError("ARIA no longer uses an external LLM client.")
