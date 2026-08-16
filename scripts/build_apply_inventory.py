import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
query = (root / "supabase/migrations/202608140011_inventory_system.sql").read_text(encoding="utf-8")
payload = {
    "project_id": "kbfcxsbibrtafkokhfev",
    "name": "202608140011_inventory_system",
    "query": query,
}
Path("/tmp/apply_inventory_migration.json").write_text(
    json.dumps(payload, ensure_ascii=False), encoding="utf-8"
)
