---
name: gpt-images
description: Generate and iterate on images with OpenAI's GPT image model through the Codex CLI - illustrations, covers, hero images, logos, icons, stickers, emoji, mascots, drawn diagrams - by exploring several ideas in parallel, showing them side by side for the user to pick, and refining the pick. Use this whenever the user wants an image made or redrawn ("make a cover for this post", "generate a logo", "draw an illustration of X in the style of this one", "I need a transparent PNG of...", "can GPT make an image for this?"), even if they don't mention Codex or GPT. Also covers the follow-up work generated images need: transparent cutouts, emoji sizes, and adding exact text or logos afterwards.
---

# GPT images

Generate images with GPT's image model by driving the Codex CLI, then run a short art-direction loop with the user: several distinct ideas, a side-by-side view to pick from, targeted revisions of the pick, and clean post-processing.

## Setup

- `S` below stands for this skill's `scripts/` directory (the folder next to this file). Call the scripts by absolute path, and pass absolute paths for reference images too.
- Run Python through uv so nothing needs installing: `uv run -q --with pillow python $S/<script>.py ...`. `cutout.py` also needs `--with numpy --with scipy`.
- Codex must be installed and logged in to an OpenAI account with image generation. `gen_image.sh` looks for `codex` on `PATH`, then at `~/.npm-global/bin/codex`; set `CODEX_BIN` if it lives elsewhere. `GPT_IMAGE_MODEL` changes the model (default `gpt-6.1-sol`).

## Generate one image

```bash
bash $S/gen_image.sh /abs/out.png "<prompt>" [/abs/reference.png ...]
```

It runs `codex exec` non-interactively, finds the image Codex saved under `~/.codex/generated_images/<session id>/`, and copies it to `out.png`. One image takes about a minute; batches run in parallel (below).

## Write the prompt

The prompt goes to a GPT agent that then calls its image tool, so write it as an instruction:

- **End with "Generate the image with your image generation tool and save it."** Without it the agent sometimes describes the image instead of making it.
- **Describe the picture, not the purpose.** Subject, what each element is doing, composition and camera angle, palette, medium and style ("painterly hand-inked illustration, warm muted palette, slight paper texture"). "A cover for my blog post about X" gives the model nothing to draw.
- **Give the shape and the background.** Landscape 3:2, square, or portrait 2:3 (outputs are 1536×1024, 1024×1024 or 1024×1536). Name the background color explicitly ("warm cream paper"), since the model drifts on it. If something will be overlaid later, say which area must stay calm ("plain empty paper in the top-left corner, no detail there").
- **Ask for no text, letters or numbers in the image.** Generated lettering is often garbled and never in the font you want. Add titles, numbers and logos afterwards (see Post-processing).
- **Use reference images for a consistent style.** Attach an earlier image and say what to take from it: "Match the style of the attached image: its line work, palette and paper texture. Do not copy its subject." For a series, keep one reference and pass it every time.
- **Avoid real people, real brands and recognizable characters.** Keep logos and mascots original.

## Explore, then show the options side by side

A single prompt rarely lands on the first try, and users choose much better between options than they describe what they want in advance. So for anything that matters:

1. **Write distinct ideas.** Different scenes or metaphors, not the same scene with tweaks. With a budget of about 4-8 images, prefer more distinct ideas over repeats: 4 ideas once each beats 2 ideas twice. Repeat an idea (the same prompt gives noticeably different results) when it is the one the user is leaning toward, or when the brief is narrow, like a simple icon.
2. **Generate them in parallel:**
   ```bash
   # spec.json: [{"id": "A", "prompt": "...", "refs": ["/abs/style.png"]}, {"id": "B", ...}]
   uv run -q python $S/gen_many.py spec.json /abs/out_dir --jobs 4
   ```
   It writes `out_dir/<id>.png` and `out_dir/manifest.json`, and skips images that already exist, so rerunning retries only the failures.
3. **Look at every image yourself first.** `uv run -q --with pillow python $S/sheet.py sheet.jpg out_dir/*.png` tiles them into one labeled image you can view in a single Read. Check the brief point by point (the calm corner, no lettering, the background color, nothing cut off at the edge) and note defects the user might miss: garbled pseudo-text, extra limbs, a style that drifted from the reference.
4. **Show them to the user.** `uv run -q python $S/review_page.py /abs/out_dir "Cover options" --note "A = robot lab, B = archive"` writes `out_dir/index.html` with every option, its label and its prompt. To share it, publish it as a private artifact (Artifact tool) with the files map from `--print-files`; otherwise give the user the local path, or show the contact sheet inline. Say which option you would pick and why, and list the defects you found.

Keep every candidate on disk until the user has chosen. Earlier rejects often come back ("actually, B with A's colors").

## Revise the pick

Attach the chosen image as a reference and ask for one change at a time, naming both what changes and what must stay:

> "Attached is the current version. Keep the angled view of the book, the robots, the palette and the line work exactly as they are. Change only one thing: the book should fill more of the frame, so there is no large empty area in the top-left corner."

Re-renders drift: they tend to flatten perspective, simplify textures and recenter the subject. Naming what to keep is the main defense, and two tries per revision give a fallback. If a revision makes things worse, go back to the previous image instead of building on the bad one.

## Post-processing

- **Exact text, numbers and logos.** Render them with Pillow and a real font file onto the finished image, never through the model. `uv run -q --with pillow python $S/overlay.py base.png mark.png out.png --corner tl --size 0.2` places a transparent PNG (logo, badge, stamp) at a corner with a soft shadow. Keep the size, corner and margin fixed across a series, so every image looks like part of the same set.
- **Transparent backgrounds** (logos, stickers, icons, emoji). Generate on a chroma-key background, then cut it out:
  - Prompt for "a solid flat magenta #FF00FF background; no magenta or pink anywhere in the subject". Use green #00FF00 if the subject is pink or purple. Avoid white: white eyes, highlights and sticker borders would be removed with it.
  - `uv run -q --with pillow --with numpy --with scipy python $S/cutout.py src.png out.png preview.png --holes` removes every background-colored pixel, including gaps enclosed by the subject (inside headphones, handles, letters). It trims 2 px off the edge where the key color bleeds in, and crops to a centered square. Without `--holes`, only background connected to the border is removed; that is the safe mode for a white or patterned background.
  - Check `preview.png`, which shows the result on white, cream and dark grounds, large and small. Leftover background in enclosed gaps and colored fringes show up on the dark ground.
  - For a transparency task, cut out every option before showing them, and build the review page from the previews: `review_page.py ... --show "{id}_prev.png"` (with the previews saved as `<id>_prev.png`).
- **Sizes.** `cutout.py --size 128` writes a 128×128 square (Slack and Discord emoji: 128×128, under 128 KB). Save paintings and photos for the web as JPEG at quality 90 (`Image.open(p).convert("RGB").save(q, quality=90)`): a 1536×1024 PNG painting is about 3 MB, the JPEG under 1 MB. Keep flat graphics as PNG.

## When it fails

- `no image produced`: read the log path in the error. Usually the agent answered in text instead of drawing (make the instruction explicit), the account lacks image access, or the model name is wrong.
- Codex hangs: it is waiting for input. The script feeds it `/dev/null`; keep that if you call `codex exec` yourself, and put the prompt after `--` whenever `--image` is used.
- Sandbox errors (for example bubblewrap failures): the read-only sandbox the script uses is enough, because the image tool saves the image itself. Don't ask the Codex agent to read or write files; attach inputs with `--image` and put any text it needs in the prompt.
