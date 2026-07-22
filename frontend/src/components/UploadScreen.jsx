import { useRef } from "react";
import AppHeader from "./AppHeader.jsx";
import BoxDrawer from "./BoxDrawer.jsx";
import { Button, Card, Field, inputClass } from "./ui.jsx";
import { CameraIcon, CheckIcon, UploadIcon } from "./icons.jsx";

const ACCEPT = ".jpg,.jpeg,.png,.tiff,.tif";

export default function UploadScreen({
  squares,
  setSquares,
  dilution,
  setDilution,
  onAnalyze,
  warming,
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

  const ready = squares.filter((s) => s.file && s.box).length;
  const allReady = ready === 4 && dilution !== "" && Number(dilution) > 0;

  return (
    <div className="min-h-full bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            New count
          </h2>
          <p className="mt-1 text-sm text-muted-fg">
            Add one photo per counting square, then drag a box over the square you
            want counted.
          </p>
        </div>

        {warming && (
          <p className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted-fg">
            Starting the server… the first load after a quiet period can take up to a
            minute. You can add your photos meanwhile.
          </p>
        )}

        <ol className="mb-6 grid gap-2 rounded-xl border border-border bg-surface p-4 text-sm text-muted-fg sm:grid-cols-3">
          <li>
            <span className="font-medium text-foreground">1.</span> Add 4 photos
          </li>
          <li>
            <span className="font-medium text-foreground">2.</span> Drag a box on each
          </li>
          <li>
            <span className="font-medium text-foreground">3.</span> Enter dilution &amp; analyze
          </li>
        </ol>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {squares.map((sq, i) => (
            <SquareCard
              key={i}
              index={i}
              square={sq}
              onPick={(f) => onPick(i, f)}
              onBox={(box) => setSquare(i, { box })}
              onClear={() => {
                if (sq.url) URL.revokeObjectURL(sq.url);
                setSquare(i, { file: null, url: null, box: null });
              }}
            />
          ))}
        </div>

        <Card className="mt-6 p-4 sm:p-5">
          <div className="max-w-sm">
            <Field
              label="Dilution factor"
              hint="Numeric factor only — for a 1:2 dilution (equal parts sample and trypan blue), enter 2."
            >
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={dilution}
                onChange={(e) => setDilution(e.target.value)}
                placeholder="e.g. 2"
                className={inputClass}
              />
            </Field>
          </div>
        </Card>

        <div className="sticky bottom-0 mt-6 -mx-4 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <Button
            onClick={onAnalyze}
            disabled={!allReady}
            className="w-full sm:w-auto sm:px-8"
          >
            Analyze cells
          </Button>
          <p className="mt-2 text-center text-xs text-muted-fg sm:text-left">
            {ready}/4 squares ready
            {ready === 4 && (!dilution || Number(dilution) <= 0)
              ? " — enter a dilution factor"
              : ""}
          </p>
        </div>
      </main>
    </div>
  );
}

function SquareCard({ index, square, onPick, onBox, onClear }) {
  const fileRef = useRef(null);
  const camRef = useRef(null);
  const done = Boolean(square.box);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="font-medium">Square {index + 1}</span>
        {done ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
            <CheckIcon className="h-4 w-4" /> Box set
          </span>
        ) : square.file ? (
          <span className="text-xs font-medium text-warning">Drag a box below</span>
        ) : null}
      </div>

      {!square.file ? (
        <div className="grid grid-cols-2 gap-2 p-4">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          {/* capture="environment" makes phones open the rear camera directly */}
          <input
            ref={camRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <UploadIcon className="h-4 w-4" /> Choose
          </Button>
          <Button variant="secondary" onClick={() => camRef.current?.click()}>
            <CameraIcon className="h-4 w-4" /> Camera
          </Button>
        </div>
      ) : (
        <div className="p-3">
          <BoxDrawer url={square.url} box={square.box} onChange={onBox} />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-fg">
              Drag across one counting square.
            </p>
            <Button variant="ghost" onClick={onClear} className="px-3">
              Replace
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
