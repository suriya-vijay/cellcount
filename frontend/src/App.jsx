import { useState } from "react";
import UploadScreen from "./components/UploadScreen.jsx";
import ProcessingScreen from "./components/ProcessingScreen.jsx";
import ResultsScreen from "./components/ResultsScreen.jsx";
import { detect, defaultParams } from "./api.js";

const EMPTY_SQUARE = () => ({
  file: null,
  url: null,
  box: null, // {x0,y0,x1,y1} normalized
});

export default function App() {
  const [screen, setScreen] = useState("upload"); // upload | processing | results
  const [squares, setSquares] = useState([
    EMPTY_SQUARE(),
    EMPTY_SQUARE(),
    EMPTY_SQUARE(),
    EMPTY_SQUARE(),
  ]);
  const [dilution, setDilution] = useState("");
  const [params, setParams] = useState(defaultParams());
  const [results, setResults] = useState([null, null, null, null]);
  const [errors, setErrors] = useState([null, null, null, null]);

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
