import { useMemo } from "react";
import s from "../../sidebar.module.css";
import { ColorField, SliderField, ToggleGroup } from "../../Fields";
import { PropertiesSection } from "../PropertiesSection";
import { usePropertiesPanel } from "../PropertiesPanelContext";
import { summarizeShadow } from "../summaries";

const SHADOW_STEP = 0.001;

export function ShadowSection() {
  const {
    block,
    shadowLinked,
    setShadowLinked,
    shadowColorDraft,
    setShadow,
    resetShadow,
    setUniformShadow,
    enableUnifiedShadow,
  } = usePropertiesPanel();

  const currentValues = useMemo((): Record<string, string> | undefined => {
    if (!block) return undefined;
    return summarizeShadow(block.shadow);
  }, [block]);

  if (!block) return null;

  return (
    <PropertiesSection title="Shadow" storageKey="shadow" currentValues={currentValues}>
      <ToggleGroup
        label="Lados"
        value={shadowLinked ? "unified" : "individual"}
        onChange={(v) => (v === "unified" ? enableUnifiedShadow() : setShadowLinked(false))}
        options={[
          { value: "unified", label: "Unificado" },
          { value: "individual", label: "Individual" },
        ]}
      />
      {shadowLinked ? (
        <SliderField
          label="Distância (%)"
          value={block.shadow.top}
          min={0}
          max={50}
          step={SHADOW_STEP}
          onChange={setUniformShadow}
        />
      ) : (
        <div className={s.grid2}>
          <SliderField
            label="Sup."
            value={block.shadow.top}
            min={0}
            max={50}
            step={SHADOW_STEP}
            onChange={(v) => setShadow({ top: v })}
          />
          <SliderField
            label="Dir."
            value={block.shadow.right}
            min={0}
            max={50}
            step={SHADOW_STEP}
            onChange={(v) => setShadow({ right: v })}
          />
          <SliderField
            label="Inf."
            value={block.shadow.bottom}
            min={0}
            max={50}
            step={SHADOW_STEP}
            onChange={(v) => setShadow({ bottom: v })}
          />
          <SliderField
            label="Esq."
            value={block.shadow.left}
            min={0}
            max={50}
            step={SHADOW_STEP}
            onChange={(v) => setShadow({ left: v })}
          />
        </div>
      )}
      <SliderField
        label="Blur (%)"
        value={block.shadow.blur}
        min={0}
        max={100}
        step={1}
        onChange={(v) => setShadow({ blur: v })}
      />
      <ColorField label="Cor" value={shadowColorDraft} onChange={(v) => setShadow({ color: v })} />
      <button type="button" className={s.smallBtn} onClick={resetShadow}>
        Zerar shadow
      </button>
    </PropertiesSection>
  );
}
