"""Genera docs/og.png (1200x630): la imagen que sale al compartir el enlace en LinkedIn/WhatsApp."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
im = Image.new("RGB", (W, H))
d = ImageDraw.Draw(im)
for y in range(H):  # degradado verde
    t = y / H
    d.line([(0, y), (W, y)], fill=(int(19 - 11 * t), int(163 - 100 * t), int(116 - 70 * t)))
F = "C:/Windows/Fonts/"
def f(n, s): return ImageFont.truetype(F + n, s)
d.text((70, 60), "⛽", font=f("seguiemj.ttf", 80), embedded_color=True)
d.text((70, 190), "¿La gasolinera más barata", font=f("segoeuib.ttf", 68), fill="white")
d.text((70, 275), "te sale más cara?", font=f("segoeuib.ttf", 68), fill=(182, 245, 216))
d.text((70, 385), "Calcula cuál te compensa DE VERDAD contando el desvío.", font=f("segoeui.ttf", 34), fill=(213, 239, 228))
d.text((70, 432), "Gratis · sin registro · precios oficiales cada hora", font=f("segoeui.ttf", 34), fill=(213, 239, 228))
d.rounded_rectangle([70, 520, 600, 585], radius=18, fill="white")
d.text((95, 532), "Gasolinera que compensa", font=f("segoeuib.ttf", 34), fill=(11, 93, 67))
foto = Path(__file__).resolve().parents[1] / "docs" / "autor.jpg"
if foto.exists():  # foto redonda con borde blanco junto al nombre
    tam = 96
    ft = Image.open(foto).convert("RGB").resize((tam, tam), Image.LANCZOS)
    mask = Image.new("L", (tam, tam), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, tam - 1, tam - 1], fill=255)
    cx, cy = W - 70 - tam, 505
    d.ellipse([cx - 4, cy - 4, cx + tam + 3, cy + tam + 3], fill="white")
    im.paste(ft, (cx, cy), mask)
    d.text((cx - 20, cy + tam // 2), "por David Jiménez", font=f("segoeuib.ttf", 30), fill="white", anchor="rm")
else:
    d.text((W - 70, 552), "por David Jiménez", font=f("segoeui.ttf", 30), fill=(213, 239, 228), anchor="rm")
out = Path(__file__).resolve().parents[1] / "docs" / "og.png"
im.save(out, optimize=True)
print(out)
