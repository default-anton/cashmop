import { CheckCircle2 } from "lucide-react";
import type React from "react";
import { Button, Card, ScreenLayout } from "../../../components";

interface InboxZeroProps {
  onRefresh: () => void;
}

export const InboxZero: React.FC<InboxZeroProps> = ({ onRefresh }) => {
  return (
    <ScreenLayout size="medium" centerContent>
      <div className="mx-auto w-full max-w-xl">
        <Card variant="default" className="p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-finance-income/20 bg-finance-income/10 text-finance-income">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <h2 className="text-3xl font-black tracking-tight text-canvas-900 select-none">Inbox Zero!</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-canvas-600 select-none">
            All transactions are categorized. Nice cleanup streak.
          </p>

          <Button onClick={onRefresh} variant="secondary" className="mx-auto mt-6 w-fit">
            Refresh
          </Button>
        </Card>
      </div>
    </ScreenLayout>
  );
};
