import { useState, useEffect } from "react";
import UploadScreen from "./components/UploadScreen.jsx";
import ProcessingScreen from "./components/ProcessingScreen.jsx";
import ResultsScreen from "./components/ResultsScreen.jsx";
import { detect, defaultParams, wake } from "./api.js";
import { saveSession, loadSession, clearSession } from "./session.js";

const EMPTY_SQUARE = () => ({
  file: null,
  url: null,
  box: null, // {x0,y0,x1,y1} normalized
  photoMissing: false, // true when restored from a reload (image not retained)
});

// Restore a previous session once, at module init, so a reload lands the user
// back on their results instead of an empty upload screen.
const restored = loadSession();

export default function App() {
  const [screen, setScreen] = useState(restored?.screen || "upload");
  const [squares, setSquares] = useState(() =>
    restored
      ? restored.boxes.map((box) => ({
          ...EMPTY_SQUARE(),
          box,
          photoMissing: true, // photos aren't persisted (too large for storage)
        }))
      : [EMPTY_SQUARE(), EMPTY_SQUARE(), EMPTY_SQUARE(), EMPTY_SQUARE()]
  );
  const [dilution, setDilution] = useState(restored?.dilution ?? "");
  const [params, setParams] = useState(restored?.params || defaultParams());
  const [results, setResults] = useState(
    restored?.results || [null, null, null, null]
  );
  const [errors, setErrors] = useState(
    restored?.errors || [null, null, null, null]
  );

  // Persist a compact snapshot whenever the meaningful state changes.
  useEffect(() => {
    if (screen === "results") {
      saveSession({ screen, dilution, params, results, errors, squares });
    }
  }, [screen, dilution, params, results, errors, squares]);

  // Wake the backend as soon as the page opens, so it boots while the user is
  // still adding photos. Free hosting sleeps when idle; without this the first
  // analysis eats the whole ~50s cold start. Only surface a notice if it's slow.
  const [warming, setWarming] = useState(false);
  useEffect(() => {
    let done = false;
    const slow = setTimeout(() => !done && setWarming(true), 2500);
    wake().finally(() => {
      done = true;
      clearTimeout(slow);
      setWarming(false);
    });
    return () => clearTimeout(slow);
  }, []);

  async function runAnalysis() {
    setScreen("processing");
    const newResults = [null, null, null, null];
    const newErrors = [null, null, null, null];

    await Promise.all(
      squares.map(async (sq, i) => {
        if (!sq.file || !sq.box) {
          newErrors[i] = "Missing image or counting box.";
          return;
        }
        try {
          newResults[i] = await detect(sq.file, sq.box, params);
        } catch (e) {
          newErrors[i] = e.message || "Analysis failed.";
        }
      })
    );

    setResults(newResults);
    setErrors(newErrors);
    setScreen("results");
  }

  // Re-run a single square after a slider change on the results screen.
  async function reRunSquare(i, nextParams) {
    const sq = squares[i];
    if (!sq.file || !sq.box) return;
    try {
      const r = await detect(sq.file, sq.box, nextParams);
      setResults((prev) => {
        const copy = [...prev];
        copy[i] = r;
        return copy;
      });
      setErrors((prev) => {
        const copy = [...prev];
        copy[i] = null;
        return copy;
      });
    } catch (e) {
      setErrors((prev) => {
        const copy = [...prev];
        copy[i] = e.message || "Analysis failed.";
        return copy;
      });
    }
  }

  function reset() {
    clearSession();
    squares.forEach((s) => s.url && URL.revokeObjectURL(s.url));
    setSquares([EMPTY_SQUARE(), EMPTY_SQUARE(), EMPTY_SQUARE(), EMPTY_SQUARE()]);
    setDilution("");
    setParams(defaultParams());
    setResults([null, null, null, null]);
    setErrors([null, null, null, null]);
    setScreen("upload");
  }

  return (
    <div className="min-h-full">
      {screen === "upload" && (
        <UploadScreen
          squares={squares}
          setSquares={setSquares}
          dilution={dilution}
          setDilution={setDilution}
          onAnalyze={runAnalysis}
          warming={warming}
        />
      )}
      {screen === "processing" && <ProcessingScreen />}
      {screen === "results" && (
        <ResultsScreen
          squares={squares}
          results={results}
          errors={errors}
          dilution={Number(dilution)}
          params={params}
          setParams={setParams}
          onReRun={reRunSquare}
          onReset={reset}
        />
      )}
    </div>
  );
}
