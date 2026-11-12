#!/usr/bin/env python3
"""Create WhatsApp Open Graph showcase from six real designer-catalog products."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
import math

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "catalog-index.json"
OUTPUT = ROOT / "assets" / "ui" / "designer-six-products-og.png"

SELECTED = [
    (897, "Кресло Релакс", "с пуфом", "Кресла"),
    (173, "Стул Чилли", "", "Полубарные стулья"),
    (1900, "Кресло Сакура", "", "Офисные кресла"),
    (1304, "Столик Андреа", "", "Кофейные столики"),
    (1709, "Шкаф Росвуд", "", "Шкафы и стеллажи"),
    (490, "Стул Амура", "", "Обеденные стулья"),
]
BG = "#F1EEEA"
CARD = "#FFFFFF"
INK = "#302C2B"
MUTED = "#887E79"
RULE = "#D9D0CA"
PRICE = "#302C2B"
SAND = "#ECE6E0"

def font(path, size):
    if not Path(path).exists():
        raise FileNotFoundError(f"Missing font: {path}")
    return ImageFont.truetype(path, size)

SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
title_font = font(SERIF, 49)
caption_font = font(SANS, 17)
minor_font = font(SANS, 13)
category_font = font(SANS, 12)
product_font = font(SERIF, 18)
price_font = font(BOLD, 23)
old_font = font(SANS, 15)
footer_font = font(SANS, 13)

def fmt(v):
    return f"{int(v):,}".replace(",", " ") + " ₽"

def pick(source_id, products):
    matches = [
        (p, v)
        for p in products
        for v in p.get("variants", [])
        if int(v["sourceId"]) == source_id
    ]
    assert len(matches) == 1, f"Expected exactly one product for {source_id}"
    p, v = matches[0]
    assert v.get("primaryImage"), f"Missing photo for {source_id}"
    path = ROOT / v["primaryImage"]
    assert path.is_file() and path.stat().st_size > 1000, f"Missing photo {path}"
    # The storefront prioritizes designerPrice over wholesalePrice.
    designer = int(v.get("designerPrice") or v["wholesalePrice"])
    retail = int(v["retailPrice"])
    assert designer > 0 and retail > designer, f"Invalid prices for {source_id}"
    return path, designer, retail, p["name"]

def fit_image(canvas, path, box):
    left, top, width, height = box
    with Image.open(path) as src:
        src = src.convert("RGBA")
        src.thumbnail((width - 12, height - 14), Image.Resampling.LANCZOS)
        matte = Image.new("RGB", src.size, "#FFFFFF")
        matte.paste(src, mask=src.getchannel("A"))
        x = left + (width - src.width) // 2
        y = top + (height - src.height) // 2
        canvas.paste(matte, (x, y))

def create():
    obj = json.loads(CATALOG.read_text(encoding="utf-8"))
    products = obj["products"]
    W, H = 1200, 630
    image = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(image)

    draw.rounded_rectangle((23, 20, 1177, 608), radius=17, fill="#F7F4F0", outline="#E3DCD5", width=2)
    draw.line((51, 46, 126, 46), fill="#BAA598", width=4)
    draw.text((149, 28), "Каталог для дизайнеров", fill=INK, font=title_font, stroke_width=0)
    draw.text((53, 91), "Мебель и предметы интерьера    •    Специальные цены", fill=MUTED, font=caption_font)

    left=40; gap=10; cw=366; top=131; rh=216; rgap=10
    for i, (source_id, line1, line2, category) in enumerate(SELECTED):
        col=i%3; row=i//3
        x=left + col * (cw + gap)
        y=top + row * (rh + rgap)
        draw.rounded_rectangle((x,y,x+cw,y+rh),radius=10,fill=CARD,outline=RULE,width=2)
        photo, designer, retail, actual = pick(source_id,products)
        # Image area is kept white, no faux product photos or image alterations.
        fit_image(image,photo,(x+7,y+8,170,rh-16))
        tx=x+179
        draw.text((tx,y+15),category.upper(),font=category_font,fill=MUTED)
        draw.text((tx,y+44),line1,font=product_font,fill=INK)
        if line2: draw.text((tx,y+68),line2,font=product_font,fill=INK)
        draw.text((tx,y+137),"ДЛЯ ДИЗАЙНЕРА",font=category_font,fill=MUTED)
        draw.text((tx,y+153),fmt(designer),font=price_font,fill=PRICE)
        old=fmt(retail)
        draw.text((tx,y+188),old,font=old_font,fill=MUTED)
        bbox=draw.textbbox((tx,y+188),old,font=old_font)
        draw.line((tx,y+197,bbox[2],y+197),fill=MUTED,width=1)
        print(f"{source_id}: {actual} | special: {designer} | retail: {retail} | {photo.relative_to(ROOT)}")
    draw.text((51, 590), "Настоящие товары и цены из электронного каталога",font=footer_font,fill=MUTED)
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    image.save(OUTPUT,format="PNG",optimize=True)
    verify=Image.open(OUTPUT)
    assert verify.size == (1200,630) and verify.mode in ("RGB","RGBA")
    assert OUTPUT.stat().st_size < 2000000, "Preview exceeds 2MB"
    print(f"Generated {OUTPUT.relative_to(ROOT)}, {OUTPUT.stat().st_size} bytes")

if __name__ == "__main__":
    create()
