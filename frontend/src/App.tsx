import { useEffect, useRef, useState } from "react";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { resetZoom, zoomIn, zoomOut } from "@/utils/uiScale";
import { EventsOn } from "../wailsjs/runtime/runtime";
import logoLandscape from "./assets/branding/logo-landscape.png";
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
        <div className="min-h-screen bg-canvas-100">
          <button
            type="button"
            onClick={() => setShowAbout(true)}
            aria-label="Open About"
            title="CashMop"
            className="fixed top-4 left-6 z-50 flex items-center px-3 py-2 bg-canvas-50/80 backdrop-blur-md border border-canvas-200 rounded-full shadow-lg transition hover:shadow-xl"
          >
            <img src={logoLandscape} alt="CashMop" className="h-8 w-auto select-none" />
          </button>
          <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex gap-1 p-1 bg-canvas-50/80 backdrop-blur-md border border-canvas-200 rounded-full shadow-lg">
            {hasData && (
              <button
                onClick={() => {
                  userNavigatedRef.current = true;
                  setScreen("analysis");
                }}
                aria-label="Navigate to Analysis"
                className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all ${
                  screen === "analysis" ? "bg-brand text-white" : "text-canvas-500 hover:text-canvas-800"
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
              className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all ${
                screen === "import" ? "bg-brand text-white" : "text-canvas-500 hover:text-canvas-800"
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
                className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all whitespace-nowrap ${
                  screen === "categorize" ? "bg-brand text-white" : "text-canvas-500 hover:text-canvas-800"
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
                className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all ${
                  screen === "rules" ? "bg-brand text-white" : "text-canvas-500 hover:text-canvas-800"
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
              className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all ${
                screen === "categories" ? "bg-brand text-white" : "text-canvas-500 hover:text-canvas-800"
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
              className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all ${
                screen === "settings" ? "bg-brand text-white" : "text-canvas-500 hover:text-canvas-800"
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
