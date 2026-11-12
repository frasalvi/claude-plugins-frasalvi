"""Tile several images into one contact sheet, to look at a batch in a single view.

Review tier: plumbing

Usage: sheet.py out.jpg img1.png img2.png ... [--cols 2] [--width 600]
Each image is scaled to the given width and labeled with its file name.
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw


def sheet(out, paths, cols=2, width=600):
    """Write a labeled grid of images.

    Args:
        out: Output path (JPEG or PNG).
        paths: Image paths.
        cols: Number of columns.
        width: Width of each tile in pixels.
    """
    tiles = []
    for p in paths:
        im = Image.open(p).convert("RGBA")
        bg = Image.new("RGBA", im.size, (128, 128, 128, 255))  # grey shows transparent areas
        im = Image.alpha_composite(bg, im).convert("RGB")
        im = im.resize((width, int(im.height * width / im.width)))
        ImageDraw.Draw(im).text((8, 6), Path(p).name, fill=(255, 0, 0))
        tiles.append(im)
    rows = -(-len(tiles) // cols)
    h = max(t.height for t in tiles)
    s = Image.new("RGB", (cols * width, rows * h), "white")
    for i, t in enumerate(tiles):
        s.paste(t, ((i % cols) * width, (i // cols) * h))
    s.save(out, quality=85)
    print(out)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--cols", type=int, default=2)
    ap.add_argument("--width", type=int, default=600)
    a = ap.parse_args()
    sheet(a.out, a.paths, a.cols, a.width)
