import { useMemo } from "react";
import s from "../../sidebar.module.css";
import { PropertiesSection } from "../PropertiesSection";
import { usePropertiesPanel } from "../PropertiesPanelContext";
import { truncateHeaderText } from "../summaries";

export function ContentSection() {
  const { block, isMask, textContent, onTextContentChange, contentTextareaRef } = usePropertiesPanel();

  const currentValues = useMemo(
    () => ({
      Texto: truncateHeaderText(textContent.replace(/\s+/g, " ")),
    }),
    [textContent],
  );

  if (!block || isMask) return null;

  return (
    <PropertiesSection title="Conteúdo" currentValues={currentValues}>
      <textarea
        ref={contentTextareaRef}
        className={s.textarea}
        value={textContent}
        onChange={(e) => onTextContentChange(e.target.value)}
        placeholder="Texto do bloco…"
      />
    </PropertiesSection>
  );
}
