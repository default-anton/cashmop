import React, { useState, useEffect } from 'react';
import { Info, Code, Heart, ExternalLink, GitBranch, Shield, Users, Zap, X } from 'lucide-react';
import { Card, Button } from '../../components';

interface AboutProps {
  onClose?: () => void;
}

const About: React.FC<AboutProps> = ({ onClose }) => {
  const [version, setVersion] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const ver = await (window as any).go.main.App.GetVersion();
        setVersion(ver);
      } catch (e) {
        console.error('Failed to fetch version', e);
      } finally {
        setLoading(false);
      }
    };
    fetchVersion();

    // Handle ESC key to close
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCheckForUpdates = () => {
    // Open GitHub releases page
    window.open('https://github.com/1917237/cashflow/releases', '_blank');
  };

  const handleViewLicense = () => {
    // Open LICENSE file or the Apache License page
    window.open('https://www.apache.org/licenses/LICENSE-2.0', '_blank');
  };

  const handleViewSource = () => {
    window.open('https://github.com/1917237/cashflow', '_blank');
  };

  return (
    <div
      className="fixed inset-0 z-[100] min-h-screen bg-black/60 backdrop-blur-sm flex items-center justify-center p-8 animate-snap-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div className="max-w-2xl w-full bg-gradient-to-br from-canvas-50 to-canvas-100 rounded-3xl shadow-glass relative overflow-hidden">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-canvas-400 hover:text-canvas-800 hover:bg-canvas-200/50 rounded-full transition-all z-10"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        )}

        {/* Header */}
        <div className="text-center pt-8 pb-6 px-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-brand to-brand/70 text-white rounded-3xl shadow-brand-glow mb-6">
            <Zap className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-black text-canvas-900 mb-2">Cashflow Tracker</h1>
          <p className="text-lg text-canvas-600 font-medium">Desktop-first cash flow tracking application</p>
        </div>

        {/* Version Card */}
        <Card variant="glass" className="p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-brand/10 text-brand rounded-xl">
                <GitBranch className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs uppercase text-canvas-500 font-bold tracking-wider mb-1">Version</p>
                {loading ? (
                  <p className="text-canvas-800 font-semibold text-lg">Loading...</p>
                ) : (
                  <p className="text-canvas-900 font-bold text-lg">{version}</p>
                )}
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCheckForUpdates}
              className="px-4 py-2 flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Check Updates
            </Button>
          </div>
        </Card>

        {/* License Card */}
        <Card variant="glass" className="p-6 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="w-6 h-6 text-brand" />
            <h2 className="text-xl font-bold text-canvas-800">License</h2>
          </div>
          <p className="text-canvas-600 mb-4">
            This application is licensed under the <span className="font-semibold text-canvas-800">Apache License 2.0</span>, a permissive free software license.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleViewLicense}
            className="px-4 py-2 flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            View Full License
          </Button>
        </Card>

        {/* Credits Card */}
        <Card variant="glass" className="p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-6 h-6 text-brand" />
            <h2 className="text-xl font-bold text-canvas-800">Credits</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-start justify-between pb-4 border-b border-canvas-200">
              <div>
                <p className="font-semibold text-canvas-900">Anton Kuzmenko</p>
                <p className="text-sm text-canvas-600">Design, Development, & Product</p>
              </div>
              <a
                href="https://github.com/1917237"
                target="_blank"
                rel="noopener noreferrer"
                className="text-canvas-400 hover:text-brand transition-colors"
                aria-label="View GitHub profile"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            </div>

            <div>
              <p className="text-sm font-bold uppercase text-canvas-500 mb-3">Built With</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm text-canvas-700">
                  <Code className="w-4 h-4 text-canvas-400" />
                  <span>Go 1.25</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-canvas-700">
                  <Code className="w-4 h-4 text-canvas-400" />
                  <span>React 19</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-canvas-700">
                  <Code className="w-4 h-4 text-canvas-400" />
                  <span>Wails v2</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-canvas-700">
                  <Code className="w-4 h-4 text-canvas-400" />
                  <span>SQLite</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-canvas-700">
                  <Code className="w-4 h-4 text-canvas-400" />
                  <span>Tailwind CSS</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-canvas-700">
                  <Code className="w-4 h-4 text-canvas-400" />
                  <span>TypeScript</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Source Code Card */}
        <Card variant="glass" className="p-6 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Info className="w-6 h-6 text-brand" />
            <h2 className="text-xl font-bold text-canvas-800">Open Source</h2>
          </div>
          <p className="text-canvas-600 mb-4">
            Cashflow Tracker is open source. Contribute, report issues, or fork the project on GitHub.
          </p>
          <Button
            variant="primary"
            onClick={handleViewSource}
            className="px-4 py-2 flex items-center gap-2"
          >
            <Code className="w-4 h-4" />
            View Source Code
          </Button>
        </Card>

        {/* Footer */}
        <div className="text-center pb-8 pt-4 px-8">
          <p className="text-sm text-canvas-500 flex items-center justify-center gap-2">
            Made with <Heart className="w-4 h-4 text-finance-expense fill-finance-expense" /> by Anton Kuzmenko
          </p>
          <p className="text-xs text-canvas-400 mt-1">© 2026 Anton Kuzmenko. All rights reserved.</p>
          <p className="text-xs text-canvas-300 mt-2">Press ESC or click outside to close</p>
        </div>
      </div>
    </div>
  );
};

export default About;
