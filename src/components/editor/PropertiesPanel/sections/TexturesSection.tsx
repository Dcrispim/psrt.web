import { useMemo } from "react";
import s from "../../sidebar.module.css";
import { PropertiesSection } from "../PropertiesSection";
import { usePropertiesPanel } from "../PropertiesPanelContext";
import { assetRefBasename, truncateHeaderText } from "../summaries";

export function TexturesSection() {
  const { block, isMask, setField } = usePropertiesPanel();

  const currentValues = useMemo(
    () => ({
      Ref: truncateHeaderText(assetRefBasename(block?.imageRef ?? "")),
    }),
    [block?.imageRef],
  );

  if (!block || !isMask) return null;

  return (
    <PropertiesSection title="Texturas" currentValues={currentValues}>
      <div className={s.field}>
        <label className={s.label}>Imagem de fundo (imageRef)</label>
        <input
          className={s.input}
          value={block.imageRef ?? ""}
          placeholder="@caminho/imagem.png"
          onChange={(e) => setField("imageRef", e.target.value)}
        />
      </div>
    </PropertiesSection>
  );
}
