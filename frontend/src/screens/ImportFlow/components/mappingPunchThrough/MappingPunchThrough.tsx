import React from 'react';

import type { MappingPunchThroughProps } from './types';
import { useMappingPunchThroughModel } from './useMappingPunchThroughModel';
import { MappingPunchThroughView } from './MappingPunchThroughView';

export const MappingPunchThrough: React.FC<MappingPunchThroughProps> = (props) => {
  const model = useMappingPunchThroughModel(props);
  return <MappingPunchThroughView model={model} />;
};
