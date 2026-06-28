export default function ProcessingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 rounded-full border-4 border-teal-600 border-t-transparent animate-spin" />
      <h2 className="text-xl font-semibold">Analyzing your samples…</h2>
      <p className="text-slate-500">Identifying cells within each counting square</p>
    </div>
  );
}
