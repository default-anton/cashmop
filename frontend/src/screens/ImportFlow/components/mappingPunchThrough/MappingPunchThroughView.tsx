import React from 'react';

import { Card } from '../../../../components';

import { STEPS } from './steps';
import type { MappingPunchThroughModel } from './useMappingPunchThroughModel';
import { WizardHeader } from './components/WizardHeader';
import { HeaderRowToggle } from './components/HeaderRowToggle';
import { AutoMappingBanner } from './components/AutoMappingBanner';
import { RememberMapping } from './components/RememberMapping';
import { AmountStepPanel } from './components/AmountStepPanel';
import { DescriptionStepPanel } from './components/DescriptionStepPanel';
import { AccountStepPanel } from './components/AccountStepPanel';
import { OwnerStepPanel } from './components/OwnerStepPanel';
import { CurrencyStepPanel } from './components/CurrencyStepPanel';
import { PreviewTable } from './components/PreviewTable';

export const MappingPunchThroughView: React.FC<{ model: MappingPunchThroughModel }> = ({ model }) => {
  const accountStepIdx = STEPS.findIndex((s) => s.key === 'account');

  return (
    <div className="flex flex-col gap-6 animate-snap-in">
      <Card variant="glass" className="p-6">
        <WizardHeader model={model} />

        <HeaderRowToggle
          hasHeader={model.hasHeader}
          detectedHasHeader={model.detectedHasHeader}
          headerSource={model.headerSource}
          onHeaderChange={model.onHeaderChange}
        />

        {model.detectedMappingName && <AutoMappingBanner detectedMappingName={model.detectedMappingName} />}

        {model.currentStepIdx === STEPS.length - 1 && (
          <RememberMapping
            rememberMapping={model.rememberMapping}
            setRememberMapping={model.setRememberMapping}
            detectedMappingName={model.detectedMappingName}
            mappingName={model.mappingName}
            setMappingName={model.setMappingName}
            saveError={model.saveError}
          />
        )}

        {model.currentStep.key === 'amount' && <AmountStepPanel model={model} />}
        {model.currentStep.key === 'description' && <DescriptionStepPanel model={model} />}
        {model.currentStep.key === 'account' && <AccountStepPanel model={model} />}
        {model.currentStep.key === 'owner' && <OwnerStepPanel model={model} />}
        {model.currentStep.key === 'currency' && <CurrencyStepPanel model={model} />}

        {!model.canProceed && model.currentStepIdx >= accountStepIdx && (
          <div className="mt-6 text-xs text-canvas-500 select-none">
            Required to continue: Date, Amount, Description, and Account.
          </div>
        )}
      </Card>

      <PreviewTable model={model} />
    </div>
  );
};
