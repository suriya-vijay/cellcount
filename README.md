# CellCount

**Live app → https://cellcount-ecig.onrender.com** — deployed and ready to use, on desktop or
phone. No install, no account.

Automates hemocytometer cell counting for cell-culture labs. Photograph four counting squares
through a microscope, mark the counting region, and CellCount detects the cells, classifies live
vs. dead (trypan blue), and computes cell density using the standard formula — plus an M1V1=M2V2
calculator for seeding to a target density and a downloadable PDF report.

Detection is a **classical OpenCV pipeline** (illumination normalization, top-hat isolation, Otsu
thresholding, morphological and shape-based filtering), validated at **89% count accuracy
(F1 0.81)** against hand-labeled ground truth. A density-map CNN was trained and evaluated
head-to-head and scored 59%, so the deterministic pipeline shipped. React/Vite + FastAPI, deployed
as a single service.

### Measured accuracy

**~89% count accuracy (F1 0.81)** on held-out test images, scored against hand-labeled ground
truth the model never saw during development. Counts are automated estimates — verify manually
when precision is critical.

That number is measured, not claimed. See [Accuracy & the ML experiment](#accuracy--the-ml-experiment).

---

## Using it on your phone

1. Open **https://cellcount-ecig.onrender.com**
2. For each of the 4 squares, tap **Camera** (shoots through the eyepiece) or **Choose** (pick an
   existing photo).
3. **Drag a box** with your finger over the counting square in each photo.
4. Enter the **dilution factor** — the numeric factor only. For a 1:2 dilution (equal parts sample
   and trypan blue), enter `2`.
5. Tap **Analyze cells**, then **Download PDF report** to save the results.

> **First load may take ~50 seconds.** The free hosting tier sleeps after inactivity and has to
> wake up. Every request after that is fast.

Any photo size works — images are normalized to a consistent internal working resolution before
detection, so counts don't change with your camera's megapixels. Uploads are capped at 25MB.

### Counting rules
- Only cells **inside the box you drew** are counted.
- Cells touching the **top/left** box edge are counted; **bottom/right** edge cells are excluded
  (the standard hemocytometer rule that prevents double-counting between squares).
- Live cells are bright dots; dead cells are dark-blue (trypan-blue stained).

### The math
```
average  = total cells across the 4 squares / 4
density  = average × dilution × 10,000   cells/mL
         = density / 1,000,000            million cells/mL
```
Worked example: squares of 45, 50, 42, 47 at dilution 2 → average 46 → 46 × 2 × 10⁴ = 920,000 =
**0.92 million cells/mL**.

The **Seed or dilute** panel then solves `M1V1 = M2V2` so you can hit a target density.

---

## How it works

The counting engine is **classical computer vision (OpenCV)** — deterministic, offline, no GPU:

1. Crop to the box you drew (this also removes the dark vignette at the edge of the field of view).
2. Flat-field correction to flatten uneven microscope lighting.
3. White top-hat transform to isolate small bright cells from the background, with the brightness
   threshold chosen automatically per image (Otsu).
4. Reject non-cells by size, roundness, elongation, fill, and core brightness — this is what keeps
   grid lines and debris out of the count.
5. Classify dead cells by their blue/dark signature.

Detection settings are exposed on the results screen if a particular image needs adjusting, but
brightness is automatic and most images need no tuning.

---

## Accuracy & the ML experiment

A density-map neural network was built and trained on hand-labeled images to try to beat the
classical pipeline (the goal was better handling of touching cells and grid lines). It was scored
honestly on held-out images:

| | Count accuracy | F1 |
|---|---|---|
| Classical pipeline (shipping) | **89.1%** | **0.81** |
| Density-map model | 59.1% | 0.35 |

**The classical pipeline won**, so it's what ships. The model lost because 7 labeled images
(312 cells) is far too little training data — not because the approach is wrong. The training code
is kept in `ml/` to revisit with a larger dataset.

**Known limits:** tightly clustered/touching cells can be under-counted, and occasional grid-line
or debris artifacts can be marked. That's the ~11%.

---

## Run it locally

Prerequisites: Python 3.10+ (developed on 3.11), Node 18+ (only to rebuild the UI).

```bash
python -m venv .venv
.venv\Scripts\activate            # Windows;  source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```
Open **http://localhost:8000** — one server serves both the API and the UI.

On Windows you can just run **`start.bat`** (builds the UI, then starts the server).

To reach it from a phone on the same Wi-Fi, start with `--host 0.0.0.0` and open
`http://<your-computer-ip>:8000`.

### Changing the UI
```bash
cd frontend && npm install && npm run build     # then commit frontend/dist
```
`frontend/dist` is committed on purpose so the deployment needs Python only.

---

## Deploy

Already deployed — this section is for redeploying or forking.

The app is **one service**: FastAPI serves the API *and* the prebuilt React UI.
**Vercel is not used and not needed** — it can't run the Python/OpenCV backend, and splitting the
app across two hosts would add work for no benefit.

On [Render](https://render.com): **New → Blueprint → select this repo.** It reads `render.yaml`:
- build: `pip install -r requirements.txt`
- start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

Pushing to `main` triggers a redeploy. The same commands work on Railway or Fly.io.

> Free tier caveat: the service sleeps after ~15 minutes idle, so the first request afterwards
> takes ~50 seconds. Subsequent requests are fast.

---

## Tests

```bash
.venv\Scripts\python.exe tests\test_detection.py
```
Uses synthetic images, so it needs no sample data. `tests/calibrate.py` and `tests/tune.py` run
detection over images in `samples/` and write overlay PNGs for visual inspection — add your own
images there (`samples/` is gitignored; lab photos stay local).

---

## Project layout

```
app/            FastAPI backend + OpenCV pipeline
  detection.py  the detection pipeline (detect_cells, detect_box)
  params.py     detection defaults + clamping
  schemas.py    request/response models
  main.py       /detect, /detect-box, /health, and serves the UI
frontend/       React + Vite + Tailwind UI (dist/ is committed)
  src/report.js PDF report (generated in the browser)
ml/             paused density-map experiment (training + honest evaluation)
tests/          detection tests + calibration scripts
render.yaml     single-service deploy config
```

## Notes
- Images are processed per request and never stored on the server.
- Reloading the page keeps your counts and calculations; the photos themselves aren't retained.
