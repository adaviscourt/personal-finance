import os
import shutil
import tempfile
from pathlib import Path


_TEST_DATA_DIR = Path(tempfile.mkdtemp(prefix="personal-finance-test-"))

# Must run before test modules import app.database, which creates the global engine.
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DATA_DIR / 'personal_finance_test.db'}"


def pytest_sessionfinish(session, exitstatus):  # noqa: ANN001, ARG001
    shutil.rmtree(_TEST_DATA_DIR, ignore_errors=True)
