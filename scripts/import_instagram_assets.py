from __future__ import annotations

import json
from pathlib import Path
from urllib.request import Request, urlopen

SOURCE = Path('/tmp/manus-mcp/mcp_result_0391a439-dd72-402f-97d2-6fdd043be14c.json')
OUT = Path('/home/ubuntu/web_hoa_tuoi/public/ig-assets')
SELECTED = {
    '18074435813392601': 'lam-tinh',
    '17985646050041446': 'garden',
    '18218451487336588': 'hoa-ly',
    '18110291272798893': 'ly-xanh',
    '18455931070140305': 'lily',
    '18401143465094931': 'mot-bo-hoa',
    '17914302915426779': 'cam-tu-cau',
    '18100659812266247': 'phi-yen',
    '18098107124257896': 'son-sac-thuy-chung',
}

payload = json.loads(SOURCE.read_text())
posts = payload['result']['data']
OUT.mkdir(parents=True, exist_ok=True)
manifest = []
for post in posts:
    post_id = str(post.get('id'))
    if post_id not in SELECTED:
        continue
    image_url = post.get('thumbnail_url') or post.get('media_url')
    if not image_url or image_url.endswith('.mp4'):
        continue
    destination = OUT / f"{SELECTED[post_id]}.jpg"
    request = Request(image_url, headers={'User-Agent': 'Mozilla/5.0'})
    with urlopen(request, timeout=30) as response:
        destination.write_bytes(response.read())
    manifest.append({
        'post_id': post_id,
        'slug': SELECTED[post_id],
        'path': f'/ig-assets/{destination.name}',
        'permalink': post.get('permalink'),
        'caption': post.get('caption', ''),
        'timestamp': post.get('timestamp'),
    })
(Path('/home/ubuntu/web_hoa_tuoi/src/lib/instagram-manifest.json')).write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(f'imported {len(manifest)} assets')
for item in manifest:
    print(item['slug'], item['path'], item['permalink'])
