import React, { useState, useEffect } from 'react';
import ImportFlow from './screens/ImportFlow/ImportFlow';
import CategorizationLoop from './screens/CategorizationLoop/CategorizationLoop';
import CategoryManager from './screens/CategoryManager/CategoryManager';
import Analysis from './screens/Analysis/Analysis';
import Settings from './screens/Settings/Settings';
import About from './screens/About/About';
import { ToastProvider } from './contexts/ToastContext';
import { EventsOn } from '../wailsjs/runtime/runtime';

function App() {
  const [showAbout, setShowAbout] = useState(false);
  const [screen, setScreen] = useState<'import' | 'categorize' | 'categories' | 'analysis' | 'settings'>('analysis');
  const [hasUncategorized, setHasUncategorized] = useState(false);
  const [hasData, setHasData] = useState(false);

  const checkStatus = async () => {
    try {
      const months = await (window as any).go.main.App.GetMonthList();
      const anyData = months && months.length > 0;
      setHasData(anyData);

      const txs = await (window as any).go.main.App.GetUncategorizedTransactions();
      const anyUncategorized = txs && txs.length > 0;
      setHasUncategorized(anyUncategorized);

      return { anyData, anyUncategorized };
    } catch (e) {
      console.error('Failed to check app status', e);
      return { anyData: false, anyUncategorized: false };
    }
  };

  useEffect(() => {
    const off = EventsOn('show-about', () => {
      setShowAbout(true);
    });

    checkStatus().then(({ anyData, anyUncategorized }) => {
      if (!anyData) {
        setScreen('import');
      } else if (anyUncategorized) {
        setScreen('categorize');
      } else {
        setScreen('analysis');
      }
    });

    return () => off?.();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case '1':
          if (hasData) setScreen('analysis');
          break;
        case '2':
          setScreen('import');
          break;
        case '3':
          if (hasData) setScreen('categorize');
          break;
        case '4':
          setScreen('categories');
          break;
        case '5':
          setScreen('settings');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasData]);

  const handleImportComplete = async () => {
    const { anyUncategorized } = await checkStatus();
    if (anyUncategorized) {
      setScreen('categorize');
    } else {
      setScreen('analysis');
    }
  };

  const handleCategorizationFinish = async () => {
    await checkStatus();
    setScreen('analysis');
  };

  if (showAbout) {
    return (
      <About isOpen={showAbout} onClose={() => setShowAbout(false)} />
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-canvas-100">
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex gap-1 p-1 bg-canvas-50/80 backdrop-blur-md border border-canvas-200 rounded-full shadow-lg">
        {hasData && (
          <button
            onClick={() => setScreen('analysis')}
            aria-label="Navigate to Analysis"
            className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all ${screen === 'analysis' ? 'bg-brand text-white' : 'text-canvas-500 hover:text-canvas-800'
              }`}
          >
            Analysis
          </button>
        )}
        <button
          onClick={() => setScreen('import')}
          aria-label="Navigate to Import"
          className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all ${screen === 'import' ? 'bg-brand text-white' : 'text-canvas-500 hover:text-canvas-800'
            }`}
        >
          Import
        </button>
        {hasData && (
          <button
            onClick={() => setScreen('categorize')}
            aria-label="Navigate to Categorize"
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all whitespace-nowrap ${screen === 'categorize' ? 'bg-brand text-white' : 'text-canvas-500 hover:text-canvas-800'
              }`}
          >
            Categorize {hasUncategorized && <span className="w-2 h-2 bg-finance-expense rounded-full" />}
          </button>
        )}
        <button
          onClick={() => setScreen('categories')}
          aria-label="Navigate to Categories"
          className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all ${screen === 'categories' ? 'bg-brand text-white' : 'text-canvas-500 hover:text-canvas-800'
            }`}
        >
          Categories
        </button>
        <button
          onClick={() => setScreen('settings')}
          aria-label="Navigate to Settings"
          className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all ${screen === 'settings' ? 'bg-brand text-white' : 'text-canvas-500 hover:text-canvas-800'
            }`}
        >
          Settings
        </button>
      </nav>

      {screen === 'import' ? (
        <ImportFlow onImportComplete={handleImportComplete} />
      ) : screen === 'categorize' ? (
        <CategorizationLoop onFinish={handleCategorizationFinish} />
      ) : screen === 'categories' ? (
        <CategoryManager />
      ) : screen === 'settings' ? (
        <Settings />
      ) : (
        <Analysis />
      )}
    </div>
    </ToastProvider>
  );
}


export default App;
