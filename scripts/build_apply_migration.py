import json
import sys
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit("usage: build_apply_migration.py <migration-file>")

migration = Path(sys.argv[1]).resolve()
payload = {
    "project_id": "kbfcxsbibrtafkokhfev",
    "name": migration.stem,
    "query": migration.read_text(encoding="utf-8"),
}
Path("/tmp/apply_migration.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
