import { useMemo } from "react";
import s from "../../sidebar.module.css";
import { SliderField, ToggleGroup } from "../../Fields";
import { PropertiesSection } from "../PropertiesSection";
import { usePropertiesPanel } from "../PropertiesPanelContext";
import { summarizeBorderRadius } from "../summaries";

export function BorderRadiusSection() {
  const {
    block,
    radiusLinked,
    setRadiusLinked,
    setBorderRadius,
    setUniformRadius,
    resetBorderRadius,
    enableUnifiedRadius,
  } = usePropertiesPanel();

  const currentValues = useMemo((): Record<string, string> | undefined => {
    if (!block) return undefined;
    return { Raio: summarizeBorderRadius(block, radiusLinked) };
  }, [block, radiusLinked]);

  if (!block) return null;

  return (
    <PropertiesSection
      title="Border radius"
      storageKey="border-radius"
      currentValues={currentValues}
    >
      <ToggleGroup
        label="Cantos"
        value={radiusLinked ? "unified" : "individual"}
        onChange={(v) => (v === "unified" ? enableUnifiedRadius() : setRadiusLinked(false))}
        options={[
          { value: "unified", label: "Unificado" },
          { value: "individual", label: "Individual" },
        ]}
      />
      {radiusLinked ? (
        <SliderField
          label="Raio"
          value={block.borderRadius.topLeft}
          min={0}
          max={100}
          step={1}
          onChange={setUniformRadius}
        />
      ) : (
        <div className={s.grid2}>
          <SliderField
            label="Sup. esq."
            value={block.borderRadius.topLeft}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setBorderRadius({ topLeft: v })}
          />
          <SliderField
            label="Sup. dir."
            value={block.borderRadius.topRight}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setBorderRadius({ topRight: v })}
          />
          <SliderField
            label="Inf. esq."
            value={block.borderRadius.bottomLeft}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setBorderRadius({ bottomLeft: v })}
          />
          <SliderField
            label="Inf. dir."
            value={block.borderRadius.bottomRight}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setBorderRadius({ bottomRight: v })}
          />
        </div>
      )}
      <button type="button" className={s.smallBtn} onClick={resetBorderRadius}>
        Zerar border radius
      </button>
    </PropertiesSection>
  );
}
