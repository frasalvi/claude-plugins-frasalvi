"""Place a transparent PNG (logo, badge, stamp) on an image, with an optional soft shadow.

Review tier: plumbing

Usage: overlay.py base.png mark.png out.png [--corner tl|tr|bl|br|center] [--size 0.2] [--margin 0.035] [--no-shadow]
--size is the mark's height as a fraction of the base image's height; --margin likewise.
"""
import argparse

from PIL import Image, ImageFilter


def overlay(base, mark, out, corner="tl", size=0.2, margin=0.035, shadow=True):
    """Composite a mark onto a base image at a corner or the center.

    Args:
        base: Base image path.
        mark: Mark image path (RGBA, transparent background).
        out: Output path.
        corner: tl, tr, bl, br or center.
        size: Mark height as a fraction of the base height.
        margin: Distance from the edges as a fraction of the base height.
        shadow: Whether to draw a soft drop shadow under the mark.
    """
    im = Image.open(base).convert("RGBA")
    W, H = im.size
    m = Image.open(mark).convert("RGBA")
    h = int(H * size)
    m = m.resize((max(1, int(m.width * h / m.height)), h), Image.LANCZOS)
    g = int(H * margin)
    x = {"tl": g, "bl": g, "tr": W - g - m.width, "br": W - g - m.width}.get(corner, (W - m.width) // 2)
    y = {"tl": g, "tr": g, "bl": H - g - h, "br": H - g - h}.get(corner, (H - h) // 2)

    # Soft shadow offset slightly down and right
    if shadow:
        sh = Image.new("RGBA", m.size, (0, 0, 0, 0))
        sh.putalpha(m.getchannel("A").point(lambda v: int(v * 0.45)))
        layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
        layer.alpha_composite(sh, (x + int(h * 0.02), y + int(h * 0.04)))
        im = Image.alpha_composite(im, layer.filter(ImageFilter.GaussianBlur(h * 0.03)))
    im.alpha_composite(m, (x, y))
    (im if out.lower().endswith(".png") else im.convert("RGB")).save(out)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("base")
    ap.add_argument("mark")
    ap.add_argument("out")
    ap.add_argument("--corner", default="tl")
    ap.add_argument("--size", type=float, default=0.2)
    ap.add_argument("--margin", type=float, default=0.035)
    ap.add_argument("--no-shadow", action="store_true")
    a = ap.parse_args()
    overlay(a.base, a.mark, a.out, a.corner, a.size, a.margin, not a.no_shadow)
    print(a.out)
