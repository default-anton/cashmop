import type React from "react";
import { MappingPunchThroughView } from "./MappingPunchThroughView";
import type { MappingPunchThroughProps } from "./types";
import { useMappingPunchThroughModel } from "./useMappingPunchThroughModel";

export const MappingPunchThrough: React.FC<MappingPunchThroughProps> = (props) => {
  const model = useMappingPunchThroughModel(props);
  return <MappingPunchThroughView model={model} />;
};
