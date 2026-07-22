import { useState } from "react";
import { MicroscopeIcon } from "./icons.jsx";
import { Button } from "./ui.jsx";
import HelpPanel from "./HelpPanel.jsx";

// Slim instrument-style header. Present on every screen for orientation.
export default function AppHeader({ right }) {
  const [help, setHelp] = useState(false);

  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-fg">
              <MicroscopeIcon className="h-[18px] w-[18px]" />
            </span>
            <div className="leading-tight">
              <h1 className="text-[15px] font-semibold tracking-tight">CellCount</h1>
              <p className="hidden text-xs text-muted-fg sm:block">
                Hemocytometer cell counting
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setHelp(true)} className="px-3">
              How to use
            </Button>
            {right}
          </div>
        </div>
      </header>
      {help && <HelpPanel onClose={() => setHelp(false)} />}
    </>
  );
}
