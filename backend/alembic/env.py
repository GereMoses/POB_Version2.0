from logging.config import fileConfig
import os

from sqlalchemy import engine_from_config, pool
from alembic import context

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override sqlalchemy.url from environment — same DATABASE_URL the app uses.
_db_url = os.getenv("DATABASE_URL", "postgresql://pob_user:pob_password@postgres:5432/pob_system")
config.set_main_option("sqlalchemy.url", _db_url)

# Import every model module so their tables are registered in Base.metadata.
# Alembic autogenerate only detects tables whose models are imported here.
from app.core.database import Base  # noqa: F401

import app.models.access_control        # noqa: F401
import app.models.benefits_management   # noqa: F401
import app.models.biometric_templates   # noqa: F401
import app.models.biotime_enhancements  # noqa: F401
import app.models.biotime_models        # noqa: F401
import app.models.certification         # noqa: F401
import app.models.custom_attributes     # noqa: F401
import app.models.department            # noqa: F401
import app.models.device                # noqa: F401
import app.models.disciplinary_management  # noqa: F401
import app.models.emergency             # noqa: F401
import app.models.emergency_enhanced    # noqa: F401
import app.models.employment_contract   # noqa: F401
import app.models.event                 # noqa: F401
import app.models.integrations          # noqa: F401  ← hr/bc integration tables
import app.models.leave_management      # noqa: F401
import app.models.meeting               # noqa: F401
import app.models.mtd                   # noqa: F401
import app.models.onboarding            # noqa: F401
import app.models.overtime_management   # noqa: F401
import app.models.payroll               # noqa: F401
import app.models.performance_management  # noqa: F401
import app.models.personnel             # noqa: F401
import app.models.pob_status            # noqa: F401
import app.models.position              # noqa: F401
import app.models.promotion_transfer    # noqa: F401
import app.models.report                # noqa: F401
import app.models.resignation           # noqa: F401
import app.models.roles                 # noqa: F401
import app.models.shift_management      # noqa: F401
import app.models.system                # noqa: F401
import app.models.training_management   # noqa: F401
import app.models.user                  # noqa: F401
import app.models.vendor_contractor     # noqa: F401
import app.models.visitor               # noqa: F401
import app.models.zone                  # noqa: F401
import app.models.zone_reader_assignment  # noqa: F401

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
