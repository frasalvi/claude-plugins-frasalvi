"""Make a flat image background transparent and crop the subject to a centered square.

Review tier: plumbing

Usage: cutout.py src.png out.png preview.png [--holes] [--size 128] [--trim 2]
The background color is read from the image corners. By default only background connected to the
image border is removed, so gaps enclosed by the subject (inside headphones, handles, letters) stay
filled. --holes removes every pixel close to the background color, wherever it is: use it with a
chroma-key background (ask for "a solid flat magenta #FF00FF background") so nothing in the subject
matches. With a white background, --holes would also erase white eyes and highlights.
--size downsizes the final square (e.g. 128 for a Slack emoji).
The preview shows the cutout on white, cream and dark grounds, large and small; enclosed leftovers
show up on the dark ground.
Needs numpy and scipy: uv run -q --with pillow --with numpy --with scipy python cutout.py ...
"""
import argparse
import numpy as np
from PIL import Image
from scipy import ndimage


def cutout(src, out, margin=0.03, t_bg=38, t_fg=230, holes=False, size=None, trim=2):
    """Remove a flat background and save the subject as a centered RGBA square.

    Args:
        src: input image path.
        out: output PNG path (RGBA).
        margin: padding around the subject as a fraction of the final side.
        t_bg: color distance below which a pixel counts as background.
        t_fg: color distance above which an edge pixel is fully opaque.
        holes: also remove background-colored pixels not connected to the border.
        size: if set, resize the final square to this many pixels.
        trim: pixels shaved off the subject's edge, where the background color bleeds in.
    """
    im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    h, w, _ = im.shape
    # background color from the four corners
    k = 20
    corners = np.concatenate([im[:k, :k], im[:k, -k:], im[-k:, :k], im[-k:, -k:]]).reshape(-1, 3)
    bg = np.median(corners, axis=0)
    dist = np.linalg.norm(im - bg, axis=2)

    # background = near-bg pixels connected to the border, or all of them with holes=True
    near = dist < t_bg
    if holes:
        bgmask = near
    else:
        labels, _ = ndimage.label(near)
        border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
        bgmask = np.isin(labels, border[border > 0])

    # shave the outermost edge pixels, which carry a tint of the background color
    if trim:
        bgmask = ndimage.binary_dilation(bgmask, iterations=trim)

    # soft edge: ramp alpha over a thin band next to the background
    alpha = np.ones((h, w), np.float32)
    alpha[bgmask] = 0
    band = ndimage.binary_dilation(bgmask, iterations=4) & ~bgmask
    ramp = np.clip((dist - t_bg) / (t_fg - t_bg), 0, 1)
    alpha[band] = ramp[band]

    # un-mix the background color from semi-transparent edge pixels
    a = alpha[..., None]
    rgb = np.where(a > 0.01, (im - (1 - a) * bg) / np.maximum(a, 0.01), 0)
    rgba = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)

    # crop to the subject and pad to a centered square
    ys, xs = np.where(alpha > 0.05)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    crop = rgba[y0:y1, x0:x1]
    side = int(max(crop.shape[:2]) / (1 - 2 * margin))
    canvas = np.zeros((side, side, 4), np.uint8)
    oy, ox = (side - crop.shape[0]) // 2, (side - crop.shape[1]) // 2
    canvas[oy:oy + crop.shape[0], ox:ox + crop.shape[1]] = crop
    img = Image.fromarray(canvas, 'RGBA')
    if size:
        img = img.resize((size, size), Image.LANCZOS)
    img.save(out, optimize=True)
    print(f'{out}: background {tuple(int(v) for v in bg)}, {img.size[0]}x{img.size[1]}')


def preview(path, out):
    """Composite the cutout on white, cream and dark, square and circle-cropped.

    Args:
        path: RGBA cutout path.
        out: preview image path.
    """
    logo = Image.open(path).convert('RGBA').resize((240, 240), Image.LANCZOS)
    small = logo.resize((48, 48), Image.LANCZOS)
    tiles = []
    for bg in ((255, 255, 255), (246, 241, 230), (18, 21, 20)):
        t = Image.new('RGBA', (320, 320), bg + (255,))
        t.alpha_composite(logo, (40, 30))
        t.alpha_composite(small, (136, 268))
        tiles.append(t)
    sheet = Image.new('RGB', (960, 320))
    for i, t in enumerate(tiles):
        sheet.paste(t.convert('RGB'), (i * 320, 0))
    sheet.save(out)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('out')
    ap.add_argument('preview')
    ap.add_argument('--holes', action='store_true')
    ap.add_argument('--size', type=int)
    ap.add_argument('--trim', type=int, default=2)
    a = ap.parse_args()
    cutout(a.src, a.out, holes=a.holes, size=a.size, trim=a.trim)
    preview(a.out, a.preview)
