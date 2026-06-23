"""
First-deploy seed — ensures a fresh database is immediately loginable.

Idempotent and safe to run on every deploy: it only creates the global admin
user if no global admin exists yet. Uses the application's own bcrypt hashing so
the seeded password verifies through the normal login path.

Run from the backend image:  python /app/seed_initial.py
Env used: DATABASE_URL, GLOBAL_ADMIN_PASSWORD, GLOBAL_ADMIN_USERNAME, GLOBAL_ADMIN_EMAIL
"""
import os
import sys

from sqlalchemy import create_engine, text

from app.core.security import get_password_hash


def seed_permissions(engine) -> None:
    """
    Populate auth_permission from the app's DEFAULT_PERMISSIONS catalogue
    (idempotent). Without this the Roles & Permissions screen lists no
    permissions, so a new role cannot be granted anything.
    """
    try:
        from app.models.roles import DEFAULT_PERMISSIONS
    except Exception as e:
        print(f"[seed] could not import DEFAULT_PERMISSIONS: {e}", flush=True)
        return
    inserted = 0
    with engine.begin() as conn:
        for p in DEFAULT_PERMISSIONS:
            r = conn.execute(text(
                "INSERT INTO auth_permission (name, codename, description) "
                "SELECT :n, :c, :cat WHERE NOT EXISTS "
                "(SELECT 1 FROM auth_permission WHERE codename = :c)"
            ), {"n": p["name"], "c": p["code"], "cat": p.get("category", "")})
            inserted += r.rowcount or 0
        total = conn.execute(text("SELECT count(*) FROM auth_permission")).scalar()
    print(f"[seed] permissions: +{inserted} (total {total})", flush=True)


def main() -> int:
    url = os.getenv("DATABASE_URL", "postgresql://pob_user:pob_password@postgres:5432/pob_system")
    username = os.getenv("GLOBAL_ADMIN_USERNAME", "globaladmin")
    password = os.getenv("GLOBAL_ADMIN_PASSWORD", "")
    email = os.getenv("GLOBAL_ADMIN_EMAIL", "admin@apexpob.local")

    engine = create_engine(url)

    # Permission catalogue — always seeded (idempotent), independent of the admin.
    seed_permissions(engine)

    if not password:
        print("[seed] GLOBAL_ADMIN_PASSWORD not set — skipping admin seed", flush=True)
        return 0

    with engine.begin() as conn:
        # Already have a global admin? Then do nothing (idempotent).
        existing = conn.execute(text(
            "SELECT username FROM auth_user WHERE is_global_admin = TRUE LIMIT 1"
        )).fetchone()
        if existing:
            print(f"[seed] global admin already exists ({existing[0]}) — nothing to do", flush=True)
            return 0

        # Discover which optional columns this auth_user has, so the INSERT works
        # regardless of minor schema variations.
        cols = {r[0] for r in conn.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'auth_user'"
        ))}

        row = {"username": username, "password": get_password_hash(password)}
        optional = {
            "email": email,
            "is_active": True,
            "is_global_admin": True,
            "is_superuser": True,
            "is_staff": True,
            "totp_enabled": False,
        }
        for col, val in optional.items():
            if col in cols:
                row[col] = val

        fields = ", ".join(row.keys())
        placeholders = ", ".join(f":{k}" for k in row)
        conn.execute(text(f"INSERT INTO auth_user ({fields}) VALUES ({placeholders})"), row)
        print(f"[seed] created global admin user '{username}'", flush=True)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # never hard-fail the deploy on a seed hiccup
        print(f"[seed] WARNING: seed step failed: {exc}", flush=True)
        sys.exit(0)
