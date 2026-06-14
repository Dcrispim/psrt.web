import { useMemo } from "react";
import { ToggleGroup } from "../../Fields";
import {
  IconAlignCenter,
  IconAlignJustify,
  IconAlignLeft,
  IconAlignRight,
  IconVBot,
  IconVMid,
  IconVTop,
} from "../../icons";
import { PropertiesSection } from "../PropertiesSection";
import { usePropertiesPanel } from "../PropertiesPanelContext";
import { alignHorizontalShort, alignVerticalShort } from "../summaries";

export function AlignmentSection() {
  const { block, isMask, setAlign } = usePropertiesPanel();

  const currentValues = useMemo((): Record<string, string> | undefined => {
    if (!block) return undefined;
    return {
      H: alignHorizontalShort(block.align.horizontal),
      V: alignVerticalShort(block.align.vertical),
    };
  }, [block]);

  if (!block || isMask) return null;

  return (
    <PropertiesSection title="Alinhamento" currentValues={currentValues}>
      <ToggleGroup
        label="Horizontal"
        value={block.align.horizontal}
        onChange={(v) => setAlign("horizontal", v)}
        options={[
          { value: "left", label: <IconAlignLeft />, title: "Esquerda" },
          { value: "center", label: <IconAlignCenter />, title: "Centro" },
          { value: "right", label: <IconAlignRight />, title: "Direita" },
          { value: "justify", label: <IconAlignJustify />, title: "Justificado" },
        ]}
      />
      <ToggleGroup
        label="Vertical"
        value={block.align.vertical}
        onChange={(v) => setAlign("vertical", v)}
        options={[
          { value: "flex-start", label: <IconVTop />, title: "Topo" },
          { value: "center", label: <IconVMid />, title: "Centro" },
          { value: "flex-end", label: <IconVBot />, title: "Base" },
        ]}
      />
    </PropertiesSection>
  );
}
