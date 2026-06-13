import { useEffect, useId, useRef, useState } from "react";
import s from "./sidebar.module.css";
import {
  ZERO_BLUR,
  ZERO_BORDER_RADIUS,
  ZERO_SHADOW,
  type Blur,
  type BlurSide,
  type BlockKind,
  type BorderRadius,
  type Shadow,
  type TextBlock,
} from "./types";
import { Section } from "./Sections";
import { SliderField, ColorField, ToggleGroup, MultiToggle, SelectField, NumberField } from "./Fields";
import {
  IconAlignLeft, IconAlignCenter, IconAlignRight, IconAlignJustify,
  IconVTop, IconVMid, IconVBot,
  IconBold, IconItalic, IconUnderline, IconStrike,
  IconPlus, IconTrash, IconDuplicate, IconEdit, IconChevronDown,
} from "./icons";
import type { InlineWrapKind } from "../../lib/inlineMarkup";
import {
  allStyleRowsFromBlock,
  blurStylePatch,
  borderRadiusStylePatch,
  isUniformBorderRadius,
  isUniformShadow,
  shadowStylePatch,
} from "../../lib/textBlockAdapter";
import { CSS_PROP_KEYS, resolveCssPropHandler } from "./cssPropHandlers";
const SHADOW_STEP = 0.001;

function shadowIsActive(shadow: Shadow): boolean {
  return shadow.top > 0 || shadow.right > 0 || shadow.bottom > 0 || shadow.left > 0;
}
interface Props {
  blocks: TextBlock[];
  activeId: string;
  textContent: string;
  onTextContentChange: (value: string) => void;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onChange: (updater: (b: TextBlock) => TextBlock) => void;
  onPatchStyle: (patch: {
    styleSet?: Record<string, string>;
    styleRemove?: string[];
  }) => void;
  onPatchStyleProp: (key: string, value: string | null) => void;
  onTypographyWrap?: (kind: InlineWrapKind, textarea: HTMLTextAreaElement) => boolean;
  fontOptions?: { value: string; label: string }[];
  emptyHint?: string;
}

export function PropertiesPanel({
  blocks,
  activeId,
  textContent,
  onTextContentChange,
  onSelect,
  onAdd,
  onDuplicate,
  onRemove,
  onChange,
  onPatchStyle,
  onPatchStyleProp,
  onTypographyWrap,
  fontOptions,
  emptyHint: _emptyHint,
}: Props) {
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const block = blocks.find((b) => b.id === activeId);
  const [draftProps, setDraftProps] = useState<{ key: string; value: string }[]>([]);
  const [showAllStyles, setShowAllStyles] = useState(false);
  const [expandedPropIndex, setExpandedPropIndex] = useState<number | null>(null);
  const [editingPropIndex, setEditingPropIndex] = useState<number | null>(null);
  const [radiusLinked, setRadiusLinked] = useState(true);
  const [shadowLinked, setShadowLinked] = useState(true);
  const [shadowColorDraft, setShadowColorDraft] = useState(ZERO_SHADOW.color);
  const shadowColorByBlockRef = useRef<Map<string, string>>(new Map());
  const editingKeyBeforeRef = useRef<string | null>(null);
  const cssPropKeyListId = useId();

  const propsSyncKey = block ? JSON.stringify(block.props) : "";

  useEffect(() => {
    if (block && !showAllStyles) setDraftProps(block.props);
  }, [block?.id, propsSyncKey, showAllStyles]);

  useEffect(() => {
    setShowAllStyles(false);
    setExpandedPropIndex(null);
    setEditingPropIndex(null);
  }, [block?.id]);

  useEffect(() => {
    if (!block) return;
    setRadiusLinked(isUniformBorderRadius(block.borderRadius));
  }, [block?.id, block?.borderRadius]);

  useEffect(() => {
    if (!block) return;
    setShadowLinked(isUniformShadow(block.shadow));
  }, [block?.id, block?.shadow]);

  useEffect(() => {
    if (!block) return;
    const remembered = shadowColorByBlockRef.current.get(block.id);
    if (shadowIsActive(block.shadow)) {
      shadowColorByBlockRef.current.set(block.id, block.shadow.color);
      setShadowColorDraft(block.shadow.color);
      return;
    }
    if (remembered) {
      setShadowColorDraft(remembered);
      return;
    }
    setShadowColorDraft(ZERO_SHADOW.color);
  }, [
    block?.id,
    block?.shadow.top,
    block?.shadow.right,
    block?.shadow.bottom,
    block?.shadow.left,
    block?.shadow.color,
  ]);

  if (!block) {
    return <TextPropertiesPanel blocks={blocks} activeId={activeId} onSelect={onSelect} onAdd={onAdd} onDuplicate={onDuplicate} onRemove={onRemove} />;
  }

  const setField = <K extends keyof TextBlock>(key: K, value: TextBlock[K]) =>
    onChange((b) => ({ ...b, [key]: value }));
  const setFont = <K extends keyof TextBlock["font"]>(key: K, value: TextBlock["font"][K]) =>
    onChange((b) => ({ ...b, font: { ...b.font, [key]: value } }));
  const setAlign = <K extends keyof TextBlock["align"]>(key: K, value: TextBlock["align"][K]) =>
    onChange((b) => ({ ...b, align: { ...b.align, [key]: value } }));

  const tryInlineOrBlock = (kind: InlineWrapKind, blockToggle: () => void) => {
    const ta = contentTextareaRef.current;
    if (ta && ta.selectionStart !== ta.selectionEnd && onTypographyWrap?.(kind, ta)) {
      return;
    }
    blockToggle();
  };

  const updatePropRowDraft = (index: number, patch: Partial<{ key: string; value: string }>) => {
    const next = [...draftProps];
    next[index] = { ...next[index], ...patch };
    setDraftProps(next);
  };

  /** Persist one CSS key to the document — never rewrites unrelated style keys. */
  const patchPropValue = (key: string, value: string) => {
    const k = key.trim();
    if (!k) return;
    onPatchStyleProp(k, value || null);
  };

  const commitDraftRow = (index: number, previousKey?: string | null) => {
    const row = draftProps[index];
    const key = row?.key.trim();
    if (!key) return;
    const prev = previousKey?.trim();
    if (prev && prev !== key) {
      onPatchStyleProp(prev, null);
    }
    onPatchStyleProp(key, row.value || null);
  };

  const applyBorderRadius = (r: BorderRadius) => {
    onPatchStyle(borderRadiusStylePatch(r));
  };

  const setBorderRadius = (patch: Partial<BorderRadius>) => {
    if (!block) return;
    applyBorderRadius({ ...block.borderRadius, ...patch });
  };

  const setUniformRadius = (value: number) => {
    applyBorderRadius({
      topLeft: value,
      topRight: value,
      bottomRight: value,
      bottomLeft: value,
    });
  };

  const resetBorderRadius = () => {
    applyBorderRadius({ ...ZERO_BORDER_RADIUS });
  };

  const enableUnifiedRadius = () => {
    setRadiusLinked(true);
    if (!block) return;
    const { topLeft, topRight, bottomRight, bottomLeft } = block.borderRadius;
    const v = Math.max(topLeft, topRight, bottomRight, bottomLeft);
    if (!isUniformBorderRadius(block.borderRadius)) {
      setUniformRadius(v);
    }
  };

  const applyBlur = (blur: Blur) => {
    onPatchStyle(blurStylePatch(blur));
  };

  const setBlurSide = (side: BlurSide) => {
    if (!block) return;
    applyBlur({ ...block.blur, side });
  };

  const setBlurAmount = (amount: number) => {
    if (!block) return;
    applyBlur({ ...block.blur, amount });
  };

  const resetBlur = () => {
    applyBlur({ ...ZERO_BLUR });
  };

  const applyShadow = (shadow: Shadow) => {
    if (!block) return;
    onPatchStyle(shadowStylePatch(shadow, block.kind));
  };

  const rememberedShadowColor = () =>
    shadowColorByBlockRef.current.get(block.id) ?? shadowColorDraft;

  const setShadow = (patch: Partial<Shadow>) => {
    if (!block) return;
    const color = patch.color ?? rememberedShadowColor();
    if (patch.color !== undefined) {
      shadowColorByBlockRef.current.set(block.id, patch.color);
      setShadowColorDraft(patch.color);
    }
    const next: Shadow = { ...block.shadow, ...patch, color };
    if (!shadowIsActive(next)) return;
    applyShadow(next);
  };

  const resetShadow = () => {
    if (!block) return;
    shadowColorByBlockRef.current.set(block.id, shadowColorDraft);
    applyShadow({ ...ZERO_SHADOW });
  };

  const setUniformShadow = (amount: number) => {
    const color = rememberedShadowColor();
    applyShadow({
      ...block.shadow,
      top: amount,
      right: amount,
      bottom: amount,
      left: amount,
      color,
    });
  };

  const enableUnifiedShadow = () => {
    setShadowLinked(true);
    if (!block) return;
    const { top, right, bottom, left } = block.shadow;
    const v = Math.max(top, right, bottom, left);
    if (!isUniformShadow(block.shadow)) {
      setUniformShadow(v);
    }
  };

  const blurSideUi = block.blur.side || "all";

  const isMask = block.kind === "mask";
  const familyOptions = fontOptions?.length
    ? fontOptions
    : [
      { value: "Inter", label: "Inter" },
      { value: "Roboto", label: "Roboto" },
      { value: "system-ui", label: "Sistema" },
    ];

  const cssRows = showAllStyles ? allStyleRowsFromBlock(block) : draftProps;

  return (
    <>
      <TextPropertiesPanel blocks={blocks} activeId={activeId} onSelect={onSelect} onAdd={onAdd} onDuplicate={onDuplicate} onRemove={onRemove} />

      <Section title="Posição & Tamanho">
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
      </Section>

      {!isMask && (
        <Section title="Conteúdo">
          <textarea
            ref={contentTextareaRef}
            className={s.textarea}
            value={textContent}
            onChange={(e) => onTextContentChange(e.target.value)}
            placeholder="Texto do bloco…"
          />
        </Section>
      )}

      {isMask && (
        <Section title="Texturas">
          <div className={s.field}>
            <label className={s.label}>Imagem de fundo (imageRef)</label>
            <input
              className={s.input}
              value={block.imageRef ?? ""}
              placeholder="@caminho/imagem.png"
              onChange={(e) => setField("imageRef", e.target.value)}
            />
          </div>
        </Section>
      )}


      <Section title="Border radius" storageKey="border-radius">
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
      </Section>

      <Section title="Blur" storageKey="blur">
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
      </Section>

      <Section title="Shadow" storageKey="shadow">
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
        <ColorField
          label="Cor"
          value={shadowColorDraft}
          onChange={(v) => setShadow({ color: v })}
        />
        <button type="button" className={s.smallBtn} onClick={resetShadow}>
          Zerar shadow
        </button>
      </Section>



      {!isMask && (
        <>
          <Section title="Tipografia">
            <SelectField
              label="Família"
              value={block.font.family}
              onChange={(v) => setFont("family", v)}
              options={familyOptions}
            />
            <SliderField
              label="Peso"
              value={block.font.weight}
              min={100}
              max={900}
              step={100}
              onChange={(v) => setFont("weight", v)}
            />
            <div className={s.grid2}>
              <NumberField label="Tamanho" suffix="px" value={block.font.size} onChange={(v) => setFont("size", v)} />
              <NumberField label="Altura linha" value={block.font.lineHeight} step={0.1} onChange={(v) => setFont("lineHeight", v)} />
            </div>
            <MultiToggle
              label="Estilo"
              options={[
                {
                  active: block.font.bold,
                  label: <IconBold />,
                  title: "Negrito",
                  onToggle: () =>
                    tryInlineOrBlock("bold", () =>
                      onChange((b) => ({
                        ...b,
                        font: {
                          ...b.font,
                          bold: !b.font.bold,
                          weight: !b.font.bold ? 700 : b.font.weight < 700 ? b.font.weight : 400,
                        },
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
          </Section>

          <Section title="Alinhamento">
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
          </Section>
        </>
      )}


      <Section title="Cores">
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
      </Section>

      <Section title="Propriedades CSS" defaultOpen={false} storageKey="css-props">
        <label className={s.cssShowAllSwitch} title="Lista todas as chaves do JSON de estilo">
          <input
            type="checkbox"
            checked={showAllStyles}
            onChange={(e) => setShowAllStyles(e.target.checked)}
          />
          <span className={s.track}>
            <span className={s.thumb} />
          </span>
          <span className={s.switchLabel}>Ver todas</span>
        </label>

        <datalist id={cssPropKeyListId}>
          {CSS_PROP_KEYS.map((key) => (
            <option key={key} value={key} />
          ))}
        </datalist>

        <ul className={s.cssPropList}>
          {cssRows.map((p, i) => {
            const valueHandler = resolveCssPropHandler(p.key);
            const isOpen = expandedPropIndex === i;
            const isEditingKey = editingPropIndex === i && !showAllStyles;
            const displayLabel = p.key.trim() || "nova propriedade";
            const rowKey = showAllStyles ? `${p.key}-${i}` : i;

            return (
              <li
                key={rowKey}
                className={`${s.cssPropItem} ${isOpen ? s.cssPropItemOpen : ""}`}
              >
                <div className={s.cssPropHead}>
                  {isEditingKey ? (
                    <input
                      className={`${s.input} ${s.cssPropKeyInput}`}
                      value={p.key}
                      autoFocus
                      placeholder="propriedade"
                      list={cssPropKeyListId}
                      onChange={(e) => updatePropRowDraft(i, { key: e.target.value })}
                      onBlur={() => {
                        commitDraftRow(i, editingKeyBeforeRef.current);
                        editingKeyBeforeRef.current = null;
                        setEditingPropIndex(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") {
                          setEditingPropIndex(null);
                          e.currentTarget.blur();
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className={s.cssPropHeadToggle}
                      onClick={() => setExpandedPropIndex(isOpen ? null : i)}
                      aria-expanded={isOpen}
                    >
                      <span className={s.cssPropLabel}>{displayLabel}</span>
                      <span
                        className={`${s.cssPropChev} ${isOpen ? s.cssPropChevOpen : ""}`}
                        aria-hidden
                      >
                        <IconChevronDown />
                      </span>
                    </button>
                  )}
                  {!isEditingKey && !showAllStyles ? (
                    <button
                      type="button"
                      className={s.cssPropEditBtn}
                      onClick={() => {
                        editingKeyBeforeRef.current = draftProps[i]?.key ?? null;
                        setExpandedPropIndex(i);
                        setEditingPropIndex(i);
                      }}
                      aria-label={`Editar nome de ${displayLabel}`}
                      title="Editar propriedade"
                    >
                      <IconEdit />
                    </button>
                  ) : null}
                </div>

                {isOpen ? (
                  <div className={s.cssPropBody}>
                    {valueHandler ? (
                      valueHandler({
                        value: p.value,
                        onChange: (value) => patchPropValue(p.key, value),
                      })
                    ) : (
                      <div className={s.propValueCell}>
                        <input
                          className={s.input}
                          value={p.value}
                          placeholder="valor"
                          onChange={(e) => {
                            if (showAllStyles) {
                              patchPropValue(p.key, e.target.value);
                              return;
                            }
                            updatePropRowDraft(i, { value: e.target.value });
                          }}
                          onBlur={() => {
                            if (!showAllStyles) commitDraftRow(i);
                          }}
                        />
                      </div>
                    )}
                    <div className={s.cssPropActions}>
                      <button
                        type="button"
                        className={s.cssPropRemoveBtn}
                        title="Remover"
                        onClick={() => {
                          const k = p.key.trim();
                          if (k) onPatchStyleProp(k, null);
                          if (!showAllStyles) {
                            setDraftProps(draftProps.filter((_, j) => j !== i));
                          }
                          setExpandedPropIndex(null);
                          setEditingPropIndex(null);
                        }}
                      >
                        <IconTrash />
                        <span>Remover</span>
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {!showAllStyles && (
          <button
            type="button"
            className={s.smallBtn}
            onClick={() => {
              const next = [...draftProps, { key: "", value: "" }];
              setDraftProps(next);
              const index = next.length - 1;
              setExpandedPropIndex(index);
              setEditingPropIndex(index);
            }}
          >
            + adicionar propriedade
          </button>
        )}
      </Section>
    </>
  );
}

interface TextPropertiesPanelProps {
  blocks: TextBlock[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}
const TextPropertiesPanel = ({ blocks, activeId, onSelect, onAdd, onDuplicate, onRemove }: TextPropertiesPanelProps) => {
  return (
    <div className={s.textBar}>
      <select className={s.select} value={activeId} onChange={(e) => onSelect(e.target.value)}>
        {blocks.map((b, i) => (
          <option key={b.id} value={b.id}>#{i + 1} — {b.name}</option>
        ))}
      </select>
      <button type="button" className={`${s.iconBtn} ${s.primary}`} onClick={onAdd} title="Adicionar bloco">
        <IconPlus />
      </button>
      <button type="button" className={s.iconBtn} onClick={onDuplicate} title="Duplicar bloco">
        <IconDuplicate />
      </button>
      <button type="button" className={`${s.iconBtn} ${s.danger}`} onClick={onRemove} title="Remover bloco">
        <IconTrash />
      </button>
    </div>
  );
};