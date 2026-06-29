"""
ARIA Knowledge Base — offline retrieval over a curated POB corpus.

Design goals:
  • Fast + offline + zero new infrastructure — uses Postgres full-text search
    (weighted tsvector), which every Postgres ships with. No model, no extension.
  • "Increase the knowledge base" = INSERT a row. No retraining, no GPU. Edits take
    effect immediately.
  • pgvector-ready (optional, not used today): if you ever want fuzzy semantic match
    on top of keyword search, an `embedding` column can be added later. Not required —
    FTS alone answers keyword/question queries well, with no model and no network.

Matching is weighted: a query term in the QUESTION (weight A) beats the same term in
KEYWORDS (B), which beats a hit in the ANSWER body (C). websearch_to_tsquery makes
natural-language questions forgiving (handles quotes, AND/OR, stop words).
"""

import re
import logging
from typing import List, Dict, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from ...core.database import SessionLocal

logger = logging.getLogger(__name__)

# Rank below which a match is considered too weak to surface as an answer.
# ts_rank on websearch_to_tsquery typically lands 0.01–0.6; 0.05 filters noise.
MIN_RANK = 0.05
# OR-recall matches only partial terms, so they rank lower — use a softer floor.
MIN_RANK_OR = 0.02


def _or_terms(query: str) -> str:
    """Build an OR tsquery string from a natural-language question:
    'zones vs areas' → 'zones | vs | areas'. to_tsquery then stems each lexeme and
    drops stop words, so an extra word the entry lacks no longer kills the match
    (websearch_to_tsquery ANDs, which is too strict for forgiving Q&A lookup)."""
    toks = [t for t in re.findall(r"[A-Za-z0-9]+", query.lower()) if len(t) >= 2]
    return " | ".join(dict.fromkeys(toks))  # dedupe, keep order


def ensure_table(db: Session) -> None:
    """Create the knowledge table + GIN index if absent. Mirrors the runtime
    CREATE-IF-NOT-EXISTS pattern already used for device_suppressed, so a fresh
    container is self-healing even before complete_schema.sql catches up."""
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS aria_knowledge (
            id          SERIAL PRIMARY KEY,
            category    TEXT NOT NULL DEFAULT 'general',
            question    TEXT NOT NULL,
            answer      TEXT NOT NULL,
            keywords    TEXT NOT NULL DEFAULT '',
            source      TEXT NOT NULL DEFAULT 'seed',
            priority    INT  NOT NULL DEFAULT 0,
            is_active   BOOLEAN NOT NULL DEFAULT TRUE,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            search_tsv  tsvector GENERATED ALWAYS AS (
                setweight(to_tsvector('english', coalesce(question, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(keywords, '')), 'B') ||
                setweight(to_tsvector('english', coalesce(answer,   '')), 'C')
            ) STORED
        )
    """))
    db.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_aria_knowledge_tsv "
        "ON aria_knowledge USING GIN (search_tsv)"
    ))
    # Unique on (category, question) so re-seeding is idempotent (ON CONFLICT).
    db.execute(text(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_aria_knowledge_q "
        "ON aria_knowledge (category, question)"
    ))
    db.commit()


def search(query: str, db: Session, k: int = 3, min_rank: float = MIN_RANK) -> List[Dict]:
    """Return up to k knowledge rows matching the query, best first.
    Empty list if nothing clears min_rank. Never raises — a KB miss must never
    break the chat response."""
    q = (query or "").strip()
    if not q:
        return []

    def _run(sql_query_fn: str, floor: float):
        rows = db.execute(text(f"""
            SELECT id, category, question, answer, priority,
                   ts_rank(search_tsv, {sql_query_fn}) AS rank
            FROM aria_knowledge
            WHERE is_active AND search_tsv @@ {sql_query_fn}
            ORDER BY rank DESC, priority DESC
            LIMIT :k
        """), {"q": q, "orq": _or_terms(q), "k": k}).fetchall()
        return [
            {"id": r.id, "category": r.category, "question": r.question,
             "answer": r.answer, "rank": float(r.rank or 0.0)}
            for r in rows if (r.rank or 0.0) >= floor
        ]

    # Tier 1 — precise AND match (websearch). Highest quality when it hits.
    try:
        hits = _run("websearch_to_tsquery('english', :q)", min_rank)
        if hits:
            return hits
    except Exception as exc:
        db.rollback()
        logger.warning("KB websearch error: %s", exc)

    # Tier 2 — OR-recall: any term matches. Catches 'zones vs areas',
    # 'report with charts', etc. where one query word isn't in the entry.
    orq = _or_terms(q)
    if orq:
        try:
            return _run("to_tsquery('english', :orq)", min(min_rank, MIN_RANK_OR))
        except Exception as exc:
            db.rollback()
            logger.warning("KB OR search error: %s", exc)

    return []


def best_answer(query: str, db: Session, min_rank: float = MIN_RANK) -> Optional[Dict]:
    """The single strongest knowledge hit, or None."""
    hits = search(query, db, k=1, min_rank=min_rank)
    return hits[0] if hits else None


def upsert(category: str, question: str, answer: str,
           keywords: str = "", source: str = "seed", priority: int = 0,
           db: Optional[Session] = None) -> None:
    """Insert or update one knowledge entry (idempotent on category+question)."""
    own = db is None
    db = db or SessionLocal()
    try:
        db.execute(text("""
            INSERT INTO aria_knowledge (category, question, answer, keywords, source, priority)
            VALUES (:c, :q, :a, :k, :s, :p)
            ON CONFLICT (category, question) DO UPDATE SET
                answer = EXCLUDED.answer, keywords = EXCLUDED.keywords,
                source = EXCLUDED.source, priority = EXCLUDED.priority,
                is_active = TRUE, updated_at = NOW()
        """), {"c": category, "q": question, "a": answer,
               "k": keywords, "s": source, "p": priority})
        db.commit()
    finally:
        if own:
            db.close()


def count(db: Session) -> int:
    try:
        return db.execute(text("SELECT count(*) FROM aria_knowledge WHERE is_active")).scalar() or 0
    except Exception:
        db.rollback()
        return 0
