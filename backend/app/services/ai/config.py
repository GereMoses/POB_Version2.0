"""
ARIA runs entirely on a local engine — live DB tools + an offline knowledge base
(Postgres full-text search). No external LLM, no API key, no network. Knowledge is
grown by adding rows to aria_knowledge (see knowledge_seed.py), not by training.
"""


def provider_info() -> dict:
    return {"provider": "ARIA Internal", "model": "knowledge-base", "free": True}
