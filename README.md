# CellCount

Automated hemocytometer cell counting for the lab. Upload one microscope image per
counting square, draw a box around the counting grid, and CellCount counts the cells
(live vs. dead via trypan blue) and computes the cell density.

**The counting engine is classical OpenCV — not an AI/LLM.** This is deliberate: vision
LLMs are unreliable at counting many small repeated objects, which is unacceptable for a
measurement that feeds experimental calculations. OpenCV is deterministic, runs offline,
and is tunable to your microscope via live sliders.

## How it works

1. **Upload** an image for each of the 4 counting squares.
2. **Draw a box** on each image over one hemocytometer counting square (on the gridlines).
3. **Enter the dilution factor** (for a 1:2 dilution, enter `2`).
4. **Analyze.** Each square is counted independently inside its box.
5. **Tune live** on the results screen with sliders if the defaults miss your cells.

### Counting rules
- Cells touching the **top/left** box edge are counted; **bottom/right** edge cells are
  excluded (standard hemocytometer de-duplication).
- Live cells = bright dots (top-hat detection). Dead cells = dark-blue stained dots.

### Density formula
```
average  = total cells / 4
density  = average × dilution × 10,000  cells/mL
         = density / 1,000,000           million cells/mL
```
Example: squares 45, 50, 42, 47 with dilution 2 → avg 46 → 46 × 2 × 10⁴ = 920,000 =
**0.92 million cells/mL**.

## Prerequisites
- Python 3.10+ (developed on 3.11)
- Node 18+

## Backend (FastAPI + OpenCV)
```bash
# from the project root c:\cellcountingv2
python -m venv .venv
.venv\Scripts\activate            # Windows;  source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload     # serves on http://localhost:8000
```
Check it: open http://localhost:8000/health → `{"status":"ok"}`.

## Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev                       # serves on http://localhost:5173
```
Open http://localhost:5173. The frontend talks to the backend on port 8000 (CORS is
preconfigured for `localhost:5173`). To point at a different backend, copy
`.env.example` to `frontend/.env` and set `VITE_API_BASE`.

## Tuning to your microscope
The default detection parameters were calibrated on phone-through-eyepiece brightfield
photos. Your scope/camera may differ. On the results screen, adjust:
- **Brightness sensitivity** — lower catches dimmer cells (and more noise).
- **Cell isolation size / min–max radius** — match your cells' pixel size.
- **Roundness filter** — higher rejects grid lines and debris.
- **Grid-line suppression** — increase if gridlines are being counted.
- **Dead darkness / blue sensitivity** — calibrate trypan-blue dead-cell detection.

Changes re-count the active square instantly.

## Known limitations
Auto-counting is an estimate. Weak spots: clumped/touching cells (enable "Split touching
cells"), out-of-focus or color-shifted images, very high density (dilute further or draw
a smaller box), and cell-sized round debris. Verify manually when precision is critical.

## Tests
```bash
.venv\Scripts\python.exe tests\test_detection.py
# or, if pytest is installed:  .venv\Scripts\python.exe -m pytest tests -q
```
`tests/calibrate.py` and `tests/tune.py` run detection over images in `samples/` and write
overlay PNGs for visual inspection. **Note:** `samples/` is not included in this repo (lab
images are kept private) — add your own hemocytometer images to that folder to use these
calibration scripts. The unit test (`test_detection.py`) uses synthetic images and needs no
samples.

## Project layout
```
app/            FastAPI backend + OpenCV pipeline
  detection.py  the cell-detection pipeline (detect_cells)
  params.py     default slider params + clamping
  schemas.py    request/response models
  main.py       /detect and /health endpoints
frontend/       React + Vite + Tailwind UI
samples/        local hemocytometer images (not committed — add your own)
tests/          detection smoke tests + calibration scripts
```
