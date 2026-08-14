import os
from pathlib import Path
import requests

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
ASSET_DIR = Path(__file__).resolve().parents[1] / "public" / "ig-assets"
FILES = [
    "lam-tinh.jpg",
    "garden.jpg",
    "hoa-ly.jpg",
    "ly-xanh.jpg",
    "lily.jpg",
    "mot-bo-hoa.jpg",
    "cam-tu-cau.jpg",
    "phi-yen.jpg",
    "son-sac-thuy-chung.jpg",
]

for filename in FILES:
    path = ASSET_DIR / filename
    target = f"v2/instagram/{filename}"
    response = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/product-images/{target}",
        headers={
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "apikey": SUPABASE_KEY,
            "Content-Type": "image/jpeg",
            "x-upsert": "true",
        },
        data=path.read_bytes(),
        timeout=60,
    )
    if response.status_code not in (200, 201):
        raise SystemExit(f"Upload failed for {filename}: HTTP {response.status_code} — {response.text[:400]}")
    print(f"uploaded {filename}")
