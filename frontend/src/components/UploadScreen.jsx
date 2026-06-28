import BoxDrawer from "./BoxDrawer.jsx";
import { MicroscopeIcon } from "./icons.jsx";

const ACCEPT = ".jpg,.jpeg,.png,.tiff,.tif";

export default function UploadScreen({
  squares,
  setSquares,
  dilution,
  setDilution,
  onAnalyze,
}) {
  function setSquare(i, patch) {
    setSquares((prev) => {
      const copy = [...prev];
      copy[i] = { ...copy[i], ...patch };
      return copy;
    });
  }

  function onPick(i, file) {
    if (!file) return;
    const prev = squares[i];
    if (prev.url) URL.revokeObjectURL(prev.url);
    setSquare(i, { file, url: URL.createObjectURL(file), box: null });
  }

  const allReady =
    squares.every((s) => s.file && s.box) &&
    dilution !== "" &&
    Number(dilution) > 0;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <header className="flex items-center gap-3 mb-2">
        <MicroscopeIcon className="w-8 h-8 text-teal-600" />
        <h1 className="text-3xl font-bold tracking-tight">CellCount</h1>
      </header>
      <p className="text-slate-500 mb-6">
        Automated hemocytometer cell counting for your lab.
      </p>

      <div className="rounded-lg bg-sky-50 border border-sky-100 text-sky-900 text-sm p-4 mb-8">
        Upload one image per counting square. After each upload,{" "}
        <strong>drag a box over one counting square</strong> (draw it on the gridlines).
        Live cells appear as bright dots; dead cells (if any) appear dark blue. Cells on
        the top/left edge are counted; bottom/right edge cells are excluded.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {squares.map((sq, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold">Square {i + 1}</span>
              {sq.box ? (
                <span className="text-xs text-teal-700 font-medium">✓ box drawn</span>
              ) : sq.file ? (
                <span className="text-xs text-amber-600 font-medium">
                  draw a box ↓
                </span>
              ) : null}
            </div>

            {!sq.file ? (
              <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-teal-500 hover:bg-teal-50/40 transition">
                <span className="text-slate-400 text-sm">
                  Click or drag image here
                </span>
                <input
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => onPick(i, e.target.files?.[0])}
                />
              </label>
            ) : (
              <div>
                <BoxDrawer
                  url={sq.url}
                  box={sq.box}
                  onChange={(box) => setSquare(i, { box })}
                />
                <button
                  className="mt-2 text-xs text-slate-500 hover:text-teal-700 underline"
                  onClick={() => {
                    if (sq.url) URL.revokeObjectURL(sq.url);
                    setSquare(i, { file: null, url: null, box: null });
                  }}
                >
                  Replace image
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 max-w-sm">
        <label className="block font-medium mb-1">Dilution Factor</label>
        <input
          type="number"
          min="0"
          step="any"
          value={dilution}
          onChange={(e) => setDilution(e.target.value)}
          placeholder="e.g. 2"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none"
        />
        <p className="text-xs text-slate-500 mt-1">
          Enter the numeric factor only. For a 1:2 dilution (equal parts sample and
          trypan blue), enter 2.
        </p>
      </div>

      <button
        disabled={!allReady}
        onClick={onAnalyze}
        className="mt-8 w-full rounded-lg bg-teal-600 text-white font-semibold py-3 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        Analyze Cells →
      </button>
    </div>
  );
}
