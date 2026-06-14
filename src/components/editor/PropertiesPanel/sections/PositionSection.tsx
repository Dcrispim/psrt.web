import { useMemo } from "react";
import s from "../../sidebar.module.css";
import { SliderField, ToggleGroup } from "../../Fields";
import type { BlockKind } from "../../types";
import { PropertiesSection } from "../PropertiesSection";
import { usePropertiesPanel } from "../PropertiesPanelContext";

export function PositionSection() {
  const { block, isMask, setField } = usePropertiesPanel();

  const currentValues = useMemo((): Record<string, string> | undefined => {
    if (!block) return undefined;
    return {
      [isMask ? "Cobertura" : "Texto"]:`X: ${Math.round(block.x)
        }%, Y: ${Math.round(block.y)}%, W: ${Math.round(block.width)}%, ${isMask ? "H: " : "S: "}${Math.round(block.height)}%`,
    };
  }, [block, isMask]);

  if (!block) return null;

  return (
    <PropertiesSection
      title="Posição & Tamanho"
      currentValues={currentValues}
    >
      <ToggleGroup
        label="Tipo de bloco"
        value={block.kind}
        onChange={(v) => setField("kind", v as BlockKind)}
        options={[
          { value: "text", label: "Texto", title: "Bloco de texto (>>)" },
          { value: "mask", label: "Cobertura", title: "Bloco de máscara (==)" },
        ]}
      />
      <div className={s.grid2}>
        <SliderField label="X" value={block.x} min={0} max={100} onChange={(v) => setField("x", v)} />
        <SliderField label="Y" value={block.y} min={0} max={100} onChange={(v) => setField("y", v)} />
        <SliderField label="Largura" value={block.width} min={1} max={100} onChange={(v) => setField("width", v)} />
        {isMask ? (
          <SliderField label="Altura (%)" value={block.height} min={0.5} max={100} onChange={(v) => setField("height", v)} />
        ) : (
          <SliderField label="Tam. base" value={block.size} min={1} max={20} onChange={(v) => setField("size", v)} />
        )}
      </div>
    </PropertiesSection>
  );
}
