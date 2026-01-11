import React, { useState } from 'react';
import { ExternalLink, Globe, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { openExternal } from '../../../utils/openExternal';

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
}

interface WebSearchResultsProps {
  query: string;
  results: WebSearchResult[] | null;
  loading: boolean;
  error: string | null;
  onSearch: () => void;
  onDismiss: () => void;
}

export const WebSearchResults: React.FC<WebSearchResultsProps> = ({
  query,
  results,
  loading,
  error,
  onSearch,
  onDismiss,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!results && !loading && !error) {
    return (
      <div className="w-full">
        <button
          onClick={onSearch}
          className="w-full flex items-center justify-center gap-2 bg-canvas-100 hover:bg-canvas-200 border-2 border-canvas-200 hover:border-brand/30 text-canvas-600 hover:text-brand rounded-xl py-3 px-4 font-bold transition-all duration-200 group select-none"
        >
          <Globe className="w-4 h-4" />
          Search Web for Context
          <kbd className="ml-auto px-2 py-0.5 bg-canvas-200 rounded text-xs font-mono opacity-60 group-hover:opacity-100 select-none">
            ⌘K
          </kbd>
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <div className="bg-white rounded-xl border border-canvas-200 shadow-sm overflow-hidden">
        <button
          onClick={() => {
            if (isExpanded) {
              onDismiss();
            } else {
              setIsExpanded(true);
            }
          }}
          className="w-full flex items-center justify-between px-4 py-3 bg-canvas-50 hover:bg-canvas-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-brand" />
            <span className="text-sm font-bold text-canvas-700 select-none">
              Web Search Context
            </span>
            {query && (
              <span className="text-xs text-canvas-500 font-mono truncate max-w-[200px]">
                "{query}"
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {loading && <Loader2 className="w-4 h-4 text-brand animate-spin" />}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="p-1 hover:bg-canvas-200 rounded transition-colors"
            >
              <X className="w-4 h-4 text-canvas-500" />
            </button>
            {!loading && (
              isExpanded ? (
                <ChevronUp className="w-4 h-4 text-canvas-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-canvas-500" />
              )
            )}
          </div>
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-4">
                {loading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-brand animate-spin" />
                    <span className="ml-2 text-canvas-600 font-medium select-none">Searching web...</span>
                  </div>
                )}

                {error && (
                  <div className="py-6 text-center text-canvas-500 select-none">
                    <p className="text-sm">{error}</p>
                    <button
                      onClick={onSearch}
                      className="mt-2 text-brand text-sm font-bold hover:underline"
                    >
                      Try again
                    </button>
                  </div>
                )}

                {results && results.length === 0 && (
                  <div className="py-6 text-center text-canvas-500 text-sm select-none">
                    No results found for this transaction
                  </div>
                )}

                {results && results.length > 0 && (
                  <div className="space-y-3">
                    {results.map((result, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="p-3 rounded-lg border border-canvas-200 hover:border-brand/30 hover:bg-brand/5 transition-all duration-200 group cursor-pointer"
                        onClick={() => openExternal(result.url)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-bold text-canvas-800 group-hover:text-brand transition-colors truncate">
                                {result.title}
                              </h4>
                              <ExternalLink className="w-3 h-3 text-canvas-400 flex-shrink-0" />
                            </div>
                            {result.snippet && (
                              <p className="text-sm text-canvas-600 line-clamp-2 mb-1">
                                {result.snippet}
                              </p>
                            )}
                            {result.domain && (
                              <span className="text-xs text-canvas-400 font-medium">
                                {result.domain}
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
