"""
Add composite index on iclock_transaction(terminal_sn, punch_time).

Queries in the attendance auto-calc loop and device poller both filter on both
columns simultaneously. Without a composite index, every 15-min attendance scan
performs a sequential scan on this table — at >1M rows this becomes the
primary bottleneck.

Run once against a live DB:
    python database/migrations/add_iclock_transaction_composite_index.py
"""

import os
import sys
import psycopg2

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://pob_user:pob_password@localhost:5432/pob_system"
)


def run():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()

    print("Creating composite index idx_iclock_txn_sn_time …")
    cur.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iclock_txn_sn_time
            ON iclock_transaction (terminal_sn, punch_time DESC);
    """)
    print("  ✅ idx_iclock_txn_sn_time created (or already exists)")

    # Supporting index for the attendance auto-calc query that also filters on
    # emp_code — keeps the JOIN to personnel fast on large transaction tables.
    print("Creating index idx_iclock_txn_emp_time …")
    cur.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iclock_txn_emp_time
            ON iclock_transaction (emp_code, punch_time DESC);
    """)
    print("  ✅ idx_iclock_txn_emp_time created (or already exists)")

    cur.close()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    run()
