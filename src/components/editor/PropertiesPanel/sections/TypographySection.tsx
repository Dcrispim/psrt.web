import { useMemo } from "react";
import s from "../../sidebar.module.css";
import { MultiToggle, NumberField, SelectField } from "../../Fields";
import {
  fontWeightBoldPair,
  isFontWeightBold,
  toggleFontWeightBold,
} from "../../../../lib/textBlockAdapter";
import { IconBold, IconItalic, IconStrike, IconUnderline } from "../../icons";
import { PropertiesSection } from "../PropertiesSection";
import { usePropertiesPanel } from "../PropertiesPanelContext";
import { truncateHeaderText } from "../summaries";

const DEFAULT_FONTS_WEIGHTS = [
  { value: 100, label: "100" },
  { value: 200, label: "200" },
  { value: 300, label: "300" },
  { value: 400, label: "400" },
  { value: 500, label: "500" },
  { value: 600, label: "600" },
  { value: 700, label: "700" },
  { value: 800, label: "800" },
  { value: 900, label: "900" },
];

export function TypographySection() {
  const { block, isMask, fontOptions, setFont, onChange, tryInlineOrBlock } = usePropertiesPanel();

  const currentValues = useMemo((): Record<string, string> | undefined => {
    if (!block) return undefined;
    const typographyStyles = [
      block.font.italic && "Itálico",
      block.font.underline && "Sublinhado",
      block.font.strike && "Tachado",
    ].filter(Boolean);

    return {
      [truncateHeaderText(block.font.family, 20)]: String(block.font.weight),
      Tamanho: block.font.sizeOverride ? `${block.font.size}px` : `${block.size} (base)`,
      ...(typographyStyles.length > 0 ? { Estilo: typographyStyles.join(", ") } : {}),
    };
  }, [block]);

  if (!block || isMask) return null;

  return (
    <PropertiesSection title="Tipografia" currentValues={currentValues}>
      <SelectField
        label="Família"
        value={block.font.family}
        onChange={(v) => setFont("family", v)}
        options={fontOptions}
      />

      <MultiToggle
        label="Estilo"
        options={[
          {
            active: isFontWeightBold(block.font.weight),
            label: <IconBold />,
            title: "Negrito",
            onToggle: () =>
              tryInlineOrBlock("bold", () =>
                onChange((b) => ({
                  ...b,
                  font: toggleFontWeightBold(b.font),
                })),
              ),
          },
          {
            active: block.font.italic,
            label: <IconItalic />,
            title: "Itálico",
            onToggle: () => tryInlineOrBlock("italic", () => setFont("italic", !block.font.italic)),
          },
          {
            active: block.font.underline,
            label: <IconUnderline />,
            title: "Sublinhado",
            onToggle: () => tryInlineOrBlock("underline", () => setFont("underline", !block.font.underline)),
          },
          {
            active: block.font.strike,
            label: <IconStrike />,
            title: "Tachado",
            onToggle: () => tryInlineOrBlock("strike", () => setFont("strike", !block.font.strike)),
          },
        ]}
      />

      <MultiToggle
        label="Peso"
        options={DEFAULT_FONTS_WEIGHTS.map((weight) => ({
          active: weight.value === block.font.weight,
          label: weight.label,
          title: weight.label,
          onToggle: () =>
            onChange((b) => ({
              ...b,
              font: { ...b.font, ...fontWeightBoldPair(weight.value) },
            })),
        }))}
      />
      <div className={s.grid2}>
        <NumberField label="Tamanho" suffix="px" value={block.font.size} onChange={(v) => setFont("size", v)} />
        <NumberField label="Altura linha" value={block.font.lineHeight} step={0.1} onChange={(v) => setFont("lineHeight", v)} />
      </div>
    </PropertiesSection>
  );
}
