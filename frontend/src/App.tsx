import { useEffect, useRef, useState } from "react";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { resetZoom, zoomIn, zoomOut } from "@/utils/uiScale";
import { EventsOn } from "../wailsjs/runtime/runtime";
import About from "./screens/About/About";
import Analysis from "./screens/Analysis/Analysis";
import CategorizationLoop from "./screens/CategorizationLoop/CategorizationLoop";
import CategoryManager from "./screens/CategoryManager/CategoryManager";
import ImportFlow from "./screens/ImportFlow/ImportFlow";
import RuleManager from "./screens/RuleManager/RuleManager";
import Settings from "./screens/Settings/Settings";

type Screen = "import" | "categorize" | "categories" | "rules" | "analysis" | "settings";

function App() {
  const [showAbout, setShowAbout] = useState(false);
  const [screen, setScreen] = useState<Screen>("analysis");
  const userNavigatedRef = useRef(false);
  const [hasUncategorized, setHasUncategorized] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [ruleCategoryFilterIds, setRuleCategoryFilterIds] = useState<number[]>([]);

  const loadStatus = async () => {
    const months = await (window as any).go.main.App.GetMonthList();
    const anyData = months && months.length > 0;
    setHasData(anyData);

    const txs = await (window as any).go.main.App.GetUncategorizedTransactions();
    const anyUncategorized = txs && txs.length > 0;
    setHasUncategorized(anyUncategorized);

    return { anyData, anyUncategorized };
  };

  const checkStatus = async () => {
    try {
      return await loadStatus();
    } catch (e) {
      console.error("Failed to check app status", e);
      await new Promise((resolve) => setTimeout(resolve, 200));
      try {
        return await loadStatus();
      } catch (err) {
        console.error("Failed to check app status after retry", err);
        return { anyData: false, anyUncategorized: false };
      }
    }
  };

  useEffect(() => {
    const off = EventsOn("show-about", () => {
      setShowAbout(true);
    });

    checkStatus().then(({ anyData, anyUncategorized }) => {
      // Don't override explicit user navigation if the user clicks around while
      // the initial status check is still in-flight.
      if (userNavigatedRef.current) return;

      if (!anyData) {
        setScreen("import");
      } else if (anyUncategorized) {
        setScreen("categorize");
      } else {
        setScreen("analysis");
      }
    });

    return () => off?.();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const modKey = e.metaKey || e.ctrlKey;

      if (modKey && !e.altKey) {
        switch (e.key) {
          // Browsers treat Cmd/Ctrl + "=" as zoom in (even without Shift)
          case "=":
          case "+":
            e.preventDefault();
            e.stopPropagation();
            zoomIn();
            return;
          case "-":
          case "_":
            e.preventDefault();
            e.stopPropagation();
            zoomOut();
            return;
          case "0":
            e.preventDefault();
            e.stopPropagation();
            resetZoom();
            return;
        }
      }

      const target = e.target;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      if (isEditable) return;

      const navigate = (next: Screen) => {
        userNavigatedRef.current = true;
        setScreen(next);
      };

      switch (e.key) {
        case "1":
          if (hasData) navigate("analysis");
          break;
        case "2":
          navigate("import");
          break;
        case "3":
          if (hasData) navigate("categorize");
          break;
        case "4":
          if (hasData) {
            setRuleCategoryFilterIds([]);
            navigate("rules");
          }
          break;
        case "5":
          navigate("categories");
          break;
        case "6":
          navigate("settings");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasData]);

  const handleImportComplete = async () => {
    const { anyUncategorized } = await checkStatus();
    if (anyUncategorized) {
      setScreen("categorize");
    } else {
      setScreen("analysis");
    }
  };

  const handleCategorizationFinish = async () => {
    await checkStatus();
    setScreen("analysis");
  };

  if (showAbout) {
    return <About isOpen={showAbout} onClose={() => setShowAbout(false)} />;
  }

  return (
    <ToastProvider>
      <CurrencyProvider>
        <div className="min-h-screen bg-canvas-100 texture-delight">
          <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex gap-1.5 p-1.5 bg-canvas-50/75 backdrop-blur-xl border border-canvas-200/80 rounded-3xl shadow-glass">
            {hasData && (
              <button
                onClick={() => {
                  userNavigatedRef.current = true;
                  setScreen("analysis");
                }}
                aria-label="Navigate to Analysis"
                className={`px-4 py-2 rounded-2xl text-[11px] font-semibold tracking-[0.12em] uppercase transition-all duration-200 ${
                  screen === "analysis"
                    ? "bg-gradient-to-r from-brand to-indigo-500 text-white shadow-brand-glow"
                    : "text-canvas-600 hover:text-canvas-900 hover:bg-canvas-200/80"
                }`}
              >
                Analysis
              </button>
            )}
            <button
              onClick={() => {
                userNavigatedRef.current = true;
                setScreen("import");
              }}
              aria-label="Navigate to Import"
              className={`px-4 py-2 rounded-2xl text-[11px] font-semibold tracking-[0.12em] uppercase transition-all duration-200 ${
                screen === "import"
                  ? "bg-gradient-to-r from-brand to-indigo-500 text-white shadow-brand-glow"
                  : "text-canvas-600 hover:text-canvas-900 hover:bg-canvas-200/80"
              }`}
            >
              Import
            </button>
            {hasUncategorized && (
              <button
                onClick={() => {
                  userNavigatedRef.current = true;
                  setScreen("categorize");
                }}
                aria-label="Navigate to Categorize"
                className={`px-4 py-2 rounded-2xl text-[11px] font-semibold tracking-[0.12em] uppercase transition-all duration-200 whitespace-nowrap ${
                  screen === "categorize"
                    ? "bg-gradient-to-r from-brand to-indigo-500 text-white shadow-brand-glow"
                    : "text-canvas-600 hover:text-canvas-900 hover:bg-canvas-200/80"
                }`}
              >
                Categorize
              </button>
            )}
            {hasData && (
              <button
                onClick={() => {
                  userNavigatedRef.current = true;
                  setRuleCategoryFilterIds([]);
                  setScreen("rules");
                }}
                aria-label="Navigate to Rules"
                className={`px-4 py-2 rounded-2xl text-[11px] font-semibold tracking-[0.12em] uppercase transition-all duration-200 ${
                  screen === "rules"
                    ? "bg-gradient-to-r from-brand to-indigo-500 text-white shadow-brand-glow"
                    : "text-canvas-600 hover:text-canvas-900 hover:bg-canvas-200/80"
                }`}
              >
                Rules
              </button>
            )}
            <button
              onClick={() => {
                userNavigatedRef.current = true;
                setScreen("categories");
              }}
              aria-label="Navigate to Categories"
              className={`px-4 py-2 rounded-2xl text-[11px] font-semibold tracking-[0.12em] uppercase transition-all duration-200 ${
                screen === "categories"
                  ? "bg-gradient-to-r from-brand to-indigo-500 text-white shadow-brand-glow"
                  : "text-canvas-600 hover:text-canvas-900 hover:bg-canvas-200/80"
              }`}
            >
              Categories
            </button>
            <button
              onClick={() => {
                userNavigatedRef.current = true;
                setScreen("settings");
              }}
              aria-label="Navigate to Settings"
              className={`px-4 py-2 rounded-2xl text-[11px] font-semibold tracking-[0.12em] uppercase transition-all duration-200 ${
                screen === "settings"
                  ? "bg-gradient-to-r from-brand to-indigo-500 text-white shadow-brand-glow"
                  : "text-canvas-600 hover:text-canvas-900 hover:bg-canvas-200/80"
              }`}
            >
              Settings
            </button>
          </nav>

          {screen === "import" ? (
            <ImportFlow onImportComplete={handleImportComplete} />
          ) : screen === "categorize" ? (
            <CategorizationLoop onFinish={handleCategorizationFinish} />
          ) : screen === "rules" ? (
            <RuleManager initialCategoryIds={ruleCategoryFilterIds} />
          ) : screen === "categories" ? (
            <CategoryManager
              onViewRules={(categoryId) => {
                userNavigatedRef.current = true;
                setRuleCategoryFilterIds([categoryId]);
                setScreen("rules");
              }}
            />
          ) : screen === "settings" ? (
            <Settings />
          ) : (
            <Analysis />
          )}
        </div>
      </CurrencyProvider>
    </ToastProvider>
  );
}

export default App;
