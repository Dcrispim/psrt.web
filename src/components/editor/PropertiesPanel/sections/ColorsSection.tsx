import { useMemo } from "react";
import { ColorField } from "../../Fields";
import { PropertiesSection } from "../PropertiesSection";
import { usePropertiesPanel } from "../PropertiesPanelContext";

export function ColorsSection() {
  const { block, isMask, onChange } = usePropertiesPanel();

  const currentValues = useMemo((): Record<string, string> | undefined => {
    if (!block) return undefined;
    const colorsSummary: Record<string, string> = {};
    if (!isMask && block.colorSet) colorsSummary.Texto = block.color;
    if (block.backgroundSet) colorsSummary.Fundo = block.background;
    if (Object.keys(colorsSummary).length === 0) colorsSummary.Estado = "Padrão";
    return colorsSummary;
  }, [block, isMask]);

  if (!block) return null;

  return (
    <PropertiesSection title="Cores" currentValues={currentValues}>
      {!isMask && (
        <ColorField
          label="Texto"
          value={block.color}
          onChange={(v) => onChange((b) => ({ ...b, color: v, colorSet: true }))}
        />
      )}
      <ColorField
        label="Fundo"
        value={block.background}
        onChange={(v) => onChange((b) => ({ ...b, background: v, backgroundSet: true }))}
      />
    </PropertiesSection>
  );
}
