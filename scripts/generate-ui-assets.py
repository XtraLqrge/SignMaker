"""Regenerate the small logo images and the ASCII face used by the interface.

Requires Pillow, fonttools and brotli. Regular npm builds use the checked-in
assets and do not require Python or these packages.
"""
from pathlib import Path
from PIL import Image
from fontTools import subset
from fontTools.ttLib import TTFont
import hashlib
import json

root = Path(__file__).resolve().parent.parent
images = root / "public/img/other-symbols"
original = Image.open(images / "icon.png").convert("RGBA")
for width, height in [(48, 38), (96, 77)]:
    original.resize((width, height), Image.Resampling.LANCZOS).save(
        images / f"logo-{width}.webp", format="WEBP", lossless=True, method=6
    )
icon = Image.new("RGBA", (32, 32))
small = original.copy()
small.thumbnail((32, 32), Image.Resampling.LANCZOS)
icon.alpha_composite(small, ((32-small.width)//2, (32-small.height)//2))
icon.save(images / "favicon-32.png", optimize=True)

font = TTFont(root / "public/fonts/ui/text.2c295d99e26dcf35.woff2")
options = subset.Options()
options.flavor = "woff2"
options.layout_features = ["kern", "liga", "calt", "ccmp", "locl", "mark", "mkmk"]
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=range(0x20, 0x7f))
subsetter.subset(font)
target = root / "public/fonts/ui/inter-basic.woff2"
font.save(target)
data = target.read_bytes()
digest = hashlib.sha256(data).hexdigest()
name = f"text.{digest[:16]}.woff2"
target.replace(target.with_name(name))
print(f"Generated {name} ({len(data):,} bytes).")
print("If the fingerprint changed, update ui-fonts.css and scripts/ui-fonts.json.")
