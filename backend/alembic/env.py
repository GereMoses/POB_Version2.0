from logging.config import fileConfig
import os

from sqlalchemy import engine_from_config, pool
from alembic import context

# Alembic config
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override sqlalchemy.url from environment so we never need to hardcode it in
# alembic.ini — the same DATABASE_URL used by the app is used for migrations.
_db_url = os.getenv("DATABASE_URL", "postgresql://pob_user:pob_password@postgres:5432/pob_system")
config.set_main_option("sqlalchemy.url", _db_url)

# Import every model module so their tables are in Base.metadata.
# This drives autogenerate: any model not imported here won't be detected.
from app.core.database import Base  # noqa: F401 — registers Base

import app.models.biotime_models        # noqa: F401
import app.models.user                  # noqa: F401
import app.models.system                # noqa: F401
import app.models.onboarding            # noqa: F401
import app.models.custom_attributes     # noqa: F401
import app.models.biometric_templates   # noqa: F401
import app.models.emergency             # noqa: F401
import app.models.vendor_contractor     # noqa: F401
import app.models.resignation           # noqa: F401

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
