from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

files = sorted(Path('/home/ubuntu/web_hoa_tuoi/public/ig-assets').glob('*.jpg'))
thumb_w, thumb_h = 260, 320
cols = 3
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * thumb_w, rows * thumb_h), '#f6f1e9')
draw = ImageDraw.Draw(sheet)
for index, path in enumerate(files):
    image = Image.open(path).convert('RGB')
    image = ImageOps.fit(image, (thumb_w - 24, thumb_h - 62), method=Image.Resampling.LANCZOS)
    x = (index % cols) * thumb_w + 12
    y = (index // cols) * thumb_h + 12
    sheet.paste(image, (x, y))
    draw.text((x, y + thumb_h - 42), path.stem, fill='#304136')
sheet.save('/home/ubuntu/web_hoa_tuoi/public/ig-assets/contact-sheet.jpg', quality=92)
