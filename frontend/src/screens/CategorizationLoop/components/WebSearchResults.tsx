import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, ExternalLink, Globe, Loader2, X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { openExternal } from "../../../utils/openExternal";

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
          className="group flex w-full items-center justify-center gap-2 rounded-2xl border border-canvas-200 bg-canvas-50/90 px-4 py-3 text-sm font-semibold text-canvas-700 shadow-sm transition-colors hover:border-brand/30 hover:bg-brand/[0.05] hover:text-brand select-none"
        >
          <Globe className="h-4 w-4" />
          Search Web for Context
          <kbd className="ml-auto rounded border border-canvas-300 bg-canvas-100 px-2 py-0.5 font-mono text-xs text-canvas-600 transition-colors group-hover:border-brand/25 group-hover:text-brand">
            ⌘K
          </kbd>
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="w-full overflow-hidden rounded-2xl border border-canvas-200 bg-canvas-50/90 shadow-card"
    >
      <div className="flex items-center justify-between gap-3 border-b border-canvas-200/80 px-4 py-3">
        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className="min-w-0 flex-1 text-left"
          aria-label={isExpanded ? "Collapse web search context" : "Expand web search context"}
        >
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-brand" />
            <span className="text-sm font-semibold text-canvas-800 select-none">Web search context</span>
            {query && <span className="truncate text-xs text-canvas-500">“{query}”</span>}
          </div>
        </button>

        <div className="flex items-center gap-1">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-brand" />}
          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            className="rounded-md p-1 text-canvas-500 transition-colors hover:bg-canvas-100 hover:text-canvas-700"
            aria-label={isExpanded ? "Collapse web search results" : "Expand web search results"}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            onClick={onDismiss}
            className="rounded-md p-1 text-canvas-500 transition-colors hover:bg-canvas-100 hover:text-canvas-700"
            aria-label="Dismiss web search context"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="p-4">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-brand" />
                  <span className="ml-2 text-sm font-medium text-canvas-600 select-none">Searching web...</span>
                </div>
              )}

              {error && (
                <div className="py-6 text-center">
                  <p className="text-sm text-canvas-500 select-none">{error}</p>
                  <button onClick={onSearch} className="mt-2 text-sm font-semibold text-brand hover:underline">
                    Try again
                  </button>
                </div>
              )}

              {results && results.length === 0 && (
                <div className="py-6 text-center text-sm text-canvas-500 select-none">
                  No results found for this transaction
                </div>
              )}

              {results && results.length > 0 && (
                <div className="space-y-2.5">
                  {results.map((result, idx) => (
                    <motion.button
                      key={idx}
                      role="link"
                      onClick={() => openExternal(result.url)}
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.16, delay: idx * 0.03 }}
                      className="group w-full rounded-xl border border-canvas-200 bg-white/90 p-3 text-left transition-colors hover:border-brand/30 hover:bg-brand/[0.04]"
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h4 className="truncate text-sm font-semibold text-canvas-800 transition-colors group-hover:text-brand">
                              {result.title}
                            </h4>
                            <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-canvas-400" />
                          </div>
                          {result.snippet && (
                            <p className="mt-1 text-sm text-canvas-600 line-clamp-2">{result.snippet}</p>
                          )}
                          {result.domain && <p className="mt-1 text-xs text-canvas-500">{result.domain}</p>}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
