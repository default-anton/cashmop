import { ArrowRight, ChevronLeft } from "lucide-react";
import type React from "react";

import { Button } from "../../../../../components";
import { STEPS } from "../steps";
import type { MappingPunchThroughModel } from "../useMappingPunchThroughModel";

export const WizardHeader: React.FC<{ model: MappingPunchThroughModel }> = ({ model }) => {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-brand/10 text-brand rounded-xl">
          <model.currentStep.icon className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-canvas-800 select-none">{model.currentStep.label}</h2>
            <span className="text-xs font-mono text-canvas-500 uppercase tracking-widest select-none">
              {model.currentStepIdx + 1} / {STEPS.length}
            </span>
          </div>
          <p className="text-canvas-500 select-none">{model.currentStep.instruction}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={model.handleBack} disabled={model.currentStepIdx === 0}>
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>

        <Button variant="primary" size="sm" onClick={model.handleAdvance} disabled={!model.canGoNext || model.saveBusy}>
          {model.saveBusy ? "Saving…" : model.currentStepIdx === STEPS.length - 1 ? "Continue" : "Next"}{" "}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
