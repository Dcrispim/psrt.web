import { useMemo } from "react";
import s from "../../sidebar.module.css";
import { SliderField, ToggleGroup } from "../../Fields";
import type { BlurSide } from "../../types";
import { PropertiesSection } from "../PropertiesSection";
import { usePropertiesPanel } from "../PropertiesPanelContext";
import { summarizeBlur } from "../summaries";

export function BlurSection() {
  const { block, blurSideUi, setBlurSide, setBlurAmount, resetBlur } = usePropertiesPanel();

  const currentValues = useMemo((): Record<string, string> | undefined => {
    if (!block) return undefined;
    return summarizeBlur(block, blurSideUi);
  }, [block, blurSideUi]);

  if (!block) return null;

  return (
    <PropertiesSection title="Blur" storageKey="blur" currentValues={currentValues}>
      <ToggleGroup
        label="Lado"
        value={blurSideUi}
        onChange={(v) => setBlurSide(v === "all" ? "" : (v as BlurSide))}
        options={[
          { value: "all", label: "Todos" },
          { value: "left", label: "Esq" },
          { value: "right", label: "Dir" },
          { value: "top", label: "Sup" },
          { value: "bottom", label: "Inf" },
        ]}
      />
      <SliderField
        label="Intensidade (%)"
        value={block.blur.amount}
        min={0}
        max={100}
        step={1}
        onChange={setBlurAmount}
      />
      <button type="button" className={s.smallBtn} onClick={resetBlur}>
        Zerar blur
      </button>
    </PropertiesSection>
  );
}
