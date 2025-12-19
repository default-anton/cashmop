import React, { useState, useEffect } from 'react';
import ImportFlow from './screens/ImportFlow/ImportFlow';
import CategorizationLoop from './screens/CategorizationLoop/CategorizationLoop';
import CategoryManager from './screens/CategoryManager/CategoryManager';

function App() {
  const [screen, setScreen] = useState<'import' | 'categorize' | 'categories'>('categorize');
  const [hasUncategorized, setHasUncategorized] = useState(false);

  const checkUncategorized = async () => {
    try {
      const txs = await (window as any).go.main.App.GetUncategorizedTransactions();
      const hasAny = txs && txs.length > 0;
      setHasUncategorized(hasAny);
      return hasAny;
    } catch (e) {
      console.error('Failed to check uncategorized transactions', e);
      return false;
    }
  };

  useEffect(() => {
    checkUncategorized().then((hasAny) => {
      if (hasAny) {
        setScreen('categorize');
      } else {
        setScreen('import');
      }
    });
  }, []);

  const handleImportComplete = async () => {
    const hasAny = await checkUncategorized();
    if (hasAny) {
      setScreen('categorize');
    }
  };

  return (
    <div className="min-h-screen bg-canvas-100">
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex gap-1 p-1 bg-canvas-50/80 backdrop-blur-md border border-canvas-200 rounded-full shadow-lg">
        <button
          onClick={() => setScreen('import')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all ${screen === 'import' ? 'bg-brand text-white' : 'text-canvas-500 hover:text-canvas-800'
            }`}
        >
          Import
        </button>
        <button
          onClick={() => setScreen('categorize')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all ${screen === 'categorize' ? 'bg-brand text-white' : 'text-canvas-500 hover:text-canvas-800'
            }`}
        >
          Categorize {hasUncategorized && <span className="inline-block w-2 h-2 bg-finance-expense rounded-full ml-1" />}
        </button>
        <button
          onClick={() => setScreen('categories')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all ${screen === 'categories' ? 'bg-brand text-white' : 'text-canvas-500 hover:text-canvas-800'
            }`}
        >
          Categories
        </button>
      </nav>

      {screen === 'import' ? (
        <ImportFlow onImportComplete={handleImportComplete} />
      ) : screen === 'categorize' ? (
        <CategorizationLoop onFinish={() => {
          setHasUncategorized(false);
          setScreen('import');
        }} />
      ) : (
        <CategoryManager />
      )}
    </div>
  );
}

export default App;
