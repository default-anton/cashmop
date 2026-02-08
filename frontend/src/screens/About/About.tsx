import {
  BookOpen,
  Check,
  Clipboard,
  Code,
  ExternalLink,
  FolderOpen,
  Heart,
  Keyboard,
  LifeBuoy,
  Rocket,
  Users,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import logoSquare from "../../assets/branding/logo-square.png";
import { Button, Card, Modal } from "../../components";
import { openExternal } from "../../utils/openExternal";

interface AboutProps {
  isOpen: boolean;
  onClose: () => void;
}

const copyToClipboard = async (value: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    return false;
  }

  return false;
};

const About: React.FC<AboutProps> = ({ isOpen, onClose }) => {
  const [version, setVersion] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [versionCopied, setVersionCopied] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

  const year = new Date().getFullYear();

  useEffect(
    () => () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const fetchVersion = async () => {
      setLoading(true);
      try {
        const nextVersion = await (window as any).go.main.App.GetVersion();
        if (!cancelled) {
          setVersion(nextVersion || "");
        }
      } catch (error) {
        console.error("Failed to fetch version", error);
        if (!cancelled) {
          setVersion("");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchVersion();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopyVersion = async () => {
    const copied = await copyToClipboard(version || "unknown");
    if (!copied) return;

    if (copyTimeoutRef.current) {
      window.clearTimeout(copyTimeoutRef.current);
    }

    setVersionCopied(true);
    copyTimeoutRef.current = window.setTimeout(() => {
      setVersionCopied(false);
    }, 1400);
  };

  const handleOpenBackupFolder = async () => {
    try {
      await (window as any).go.main.App.OpenBackupFolder();
    } catch (error) {
      console.error("Failed to open backup folder", error);
    }
  };

  const shortcuts = [
    { keys: "1", label: "Analysis" },
    { keys: "2", label: "Import" },
    { keys: "3", label: "Categorize" },
    { keys: "4", label: "Rules" },
    { keys: "5", label: "Categories" },
    { keys: "6", label: "Settings" },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} variant="full" size="full">
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full border border-canvas-200 bg-canvas-50/95 p-2 text-canvas-500 transition-colors hover:border-canvas-300 hover:text-canvas-800"
        aria-label="Close about dialog"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="px-6 pb-6 pt-6">
        <div className="space-y-4">
          <header className="flex items-start gap-4">
            <div className="rounded-3xl border border-brand/25 bg-gradient-to-br from-brand/20 to-brand-alt/20 p-3.5 text-brand shadow-brand-glow">
              <img src={logoSquare} alt="CashMop" className="h-8 w-8 select-none" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-canvas-900 select-none">About CashMop</h1>
              <p className="mt-1 text-sm font-semibold text-canvas-600 select-none">
                Desktop-first cash flow tracking with fast loops and clear data.
              </p>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1fr]">
            <Card variant="default" className="p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-canvas-500 select-none">Build</p>
                  <p className="mt-1 text-2xl font-black text-canvas-900 select-none">
                    {loading ? "Loading..." : version || "Unknown"}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyVersion}
                  className="whitespace-nowrap"
                  aria-label="Copy app version"
                >
                  {versionCopied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                  {versionCopied ? "Copied" : "Copy"}
                </Button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="whitespace-nowrap !px-2.5 !text-xs"
                  onClick={() => openExternal("https://github.com/default-anton/cashmop/releases")}
                >
                  <Rocket className="h-4 w-4" />
                  Releases
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="whitespace-nowrap !px-2.5 !text-xs"
                  onClick={() => openExternal("https://github.com/default-anton/cashmop")}
                >
                  <Code className="h-4 w-4" />
                  Source
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="whitespace-nowrap !px-2.5 !text-xs"
                  onClick={() => openExternal("https://github.com/default-anton/cashmop/issues/new/choose")}
                >
                  <LifeBuoy className="h-4 w-4" />
                  Report Issue
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="whitespace-nowrap !px-2.5 !text-xs"
                  onClick={handleOpenBackupFolder}
                >
                  <FolderOpen className="h-4 w-4" />
                  Backup Folder
                </Button>
              </div>
            </Card>

            <Card variant="default" className="p-4 shadow-card">
              <div className="mb-2 flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-brand" />
                <h2 className="text-sm font-bold text-canvas-900 select-none">Keyboard shortcuts</h2>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {shortcuts.map((item) => (
                  <div
                    key={item.keys}
                    className="flex items-center justify-between rounded-lg border border-canvas-200/80 bg-canvas-50/85 px-3 py-1.5"
                  >
                    <span className="text-sm text-canvas-700 select-none">{item.label}</span>
                    <span className="rounded border border-canvas-200 bg-canvas-100 px-1.5 py-0.5 font-mono text-xs text-canvas-700">
                      {item.keys}
                    </span>
                  </div>
                ))}

                <div className="col-span-2 flex items-center justify-between rounded-lg border border-canvas-200/80 bg-canvas-50/85 px-3 py-1.5">
                  <span className="text-sm text-canvas-700 select-none">Zoom in, out, reset</span>
                  <span className="rounded border border-canvas-200 bg-canvas-100 px-1.5 py-0.5 font-mono text-xs text-canvas-700 whitespace-nowrap">
                    ⌘/Ctrl + + / - / 0
                  </span>
                </div>
              </div>
            </Card>
          </div>

          <Card variant="default" className="overflow-hidden p-0 shadow-card">
            <div className="divide-y divide-canvas-200/80">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-canvas-500 select-none">Credits</p>
                  <p className="text-sm font-semibold text-canvas-900">Anton Kuzmenko</p>
                  <p className="text-sm text-canvas-600">Design, development, and product</p>
                </div>
                <button
                  onClick={() => openExternal("https://github.com/default-anton")}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline whitespace-nowrap"
                  aria-label="View Anton Kuzmenko GitHub profile"
                >
                  GitHub
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-canvas-500 select-none">Built with</p>
                <p className="mt-1 text-sm text-canvas-700 whitespace-nowrap overflow-x-auto">
                  Go 1.25 · React 19 · Wails v2 · SQLite · Tailwind CSS · TypeScript
                </p>
              </div>

              <div className="px-4 py-2.5">
                <p className="flex items-center justify-center gap-2 text-sm text-canvas-600">
                  Made with <Heart className="h-4 w-4 fill-finance-expense text-finance-expense" /> by Anton Kuzmenko
                </p>
                <p className="mt-0.5 text-center text-xs text-canvas-500 select-none">
                  © {year} Anton Kuzmenko. All rights reserved.
                </p>
                <div className="mt-1.5 flex items-center justify-center gap-3 text-xs font-semibold text-canvas-500">
                  <button
                    onClick={() => openExternal("https://www.apache.org/licenses/LICENSE-2.0")}
                    className="inline-flex items-center gap-1 hover:text-canvas-700"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    License
                  </button>
                  <span>•</span>
                  <button
                    onClick={() => openExternal("https://github.com/default-anton/cashmop/blob/main/README.md")}
                    className="inline-flex items-center gap-1 hover:text-canvas-700"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Readme
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Modal>
  );
};

export default About;
