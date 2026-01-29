import { Code, ExternalLink, GitBranch, Heart, Users, X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import logoSquare from "../../assets/branding/logo-square.png";
import { Button, Card, Modal } from "../../components";
import { openExternal } from "../../utils/openExternal";

interface AboutProps {
  isOpen: boolean;
  onClose: () => void;
}

const About: React.FC<AboutProps> = ({ isOpen, onClose }) => {
  const [version, setVersion] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const year = new Date().getFullYear();

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const ver = await (window as any).go.main.App.GetVersion();
        setVersion(ver);
      } catch (e) {
        console.error("Failed to fetch version", e);
      } finally {
        setLoading(false);
      }
    };
    fetchVersion();
  }, []);

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

  const handleCheckForUpdates = () => {
    openExternal("https://github.com/default-anton/cashmop/releases");
  };

  const handleViewLicense = () => {
    openExternal("https://www.apache.org/licenses/LICENSE-2.0");
  };

  const handleViewSource = () => {
    openExternal("https://github.com/default-anton/cashmop");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} variant="full" size="full">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-canvas-400 hover:text-canvas-800 hover:bg-canvas-200/50 rounded-full transition-all z-10"
        aria-label="Close"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="max-h-[78vh] overflow-y-auto custom-scrollbar">
        <div className="text-center pt-6 pb-4 px-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-canvas-50 border border-canvas-200 rounded-2xl shadow-card mb-4">
            <img src={logoSquare} alt="CashMop" className="w-12 h-12 select-none" />
          </div>
          <h1 className="text-3xl font-black text-canvas-900 mb-1 select-none">CashMop</h1>
          <p className="text-base text-canvas-600 font-medium select-none">Desktop-first cash flow tracking app</p>
        </div>

        <Card variant="default" className="p-4 mb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand/10 text-brand rounded-lg">
                <GitBranch className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs uppercase text-canvas-600 font-semibold tracking-wider mb-0.5 select-none">
                  Version
                </p>
                {loading ? (
                  <p className="text-canvas-800 font-semibold text-lg">Loading...</p>
                ) : version ? (
                  <p className="text-canvas-900 font-bold text-lg">{version}</p>
                ) : (
                  <p className="text-canvas-600 font-semibold text-lg">Unknown</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={handleCheckForUpdates}>
                <ExternalLink className="w-4 h-4" />
                Updates
              </Button>
              <Button variant="secondary" size="sm" onClick={handleViewLicense}>
                <ExternalLink className="w-4 h-4" />
                License
              </Button>
              <Button variant="secondary" size="sm" onClick={handleViewSource}>
                <Code className="w-4 h-4" />
                Source
              </Button>
            </div>
          </div>
          <p className="text-sm text-canvas-600 mt-3">
            Licensed under <span className="font-semibold text-canvas-800">Apache License 2.0</span>.
          </p>
        </Card>

        <Card variant="default" className="p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <Users className="w-5 h-5 text-brand" />
            <h2 className="text-lg font-bold text-canvas-800 select-none">Credits</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-canvas-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand/10 text-brand font-semibold flex items-center justify-center">
                  AK
                </div>
                <div>
                  <p className="font-semibold text-canvas-900">Anton Kuzmenko</p>
                  <p className="text-sm text-canvas-600">Design, Development, & Product</p>
                </div>
              </div>
              <button
                onClick={() => openExternal("https://github.com/default-anton")}
                className="text-canvas-400 hover:text-brand transition-colors"
                aria-label="View GitHub profile"
              >
                <ExternalLink className="w-5 h-5" />
              </button>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-canvas-600 tracking-wider mb-2 select-none">
                Built With
              </p>
              <div className="flex flex-wrap gap-2">
                {["Go 1.25", "React 19", "Wails v2", "SQLite", "Tailwind CSS", "TypeScript"].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-canvas-200 bg-canvas-100 px-3 py-1 text-xs text-canvas-700"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className="text-center pb-6 pt-2 px-6">
          <p className="text-sm text-canvas-500 flex items-center justify-center gap-2">
            Made with <Heart className="w-4 h-4 text-finance-expense fill-finance-expense" /> by Anton Kuzmenko
          </p>
          <p className="text-xs text-canvas-500 mt-1 select-none">© {year} Anton Kuzmenko. All rights reserved.</p>
          <p className="text-xs text-canvas-500 mt-2 select-none">Press ESC or click outside to close</p>
        </div>
      </div>
    </Modal>
  );
};

export default About;
