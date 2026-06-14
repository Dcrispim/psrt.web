import { useMemo } from "react";
import s from "../../sidebar.module.css";
import { CSS_PROP_KEYS, resolveCssPropHandler } from "../../cssPropHandlers";
import { IconChevronDown, IconEdit, IconTrash } from "../../icons";
import { PropertiesSection } from "../PropertiesSection";
import { usePropertiesPanel } from "../PropertiesPanelContext";

export function CssPropsSection() {
  const {
    block,
    showAllStyles,
    setShowAllStyles,
    cssPropKeyListId,
    cssRows,
    draftProps,
    setDraftProps,
    expandedPropIndex,
    setExpandedPropIndex,
    editingPropIndex,
    setEditingPropIndex,
    editingKeyBeforeRef,
    updatePropRowDraft,
    patchPropValue,
    commitDraftRow,
    onPatchStyleProp,
  } = usePropertiesPanel();

  const currentValues = useMemo(
    () => ({
      Modo: showAllStyles ? "Todas" : "Custom",
      Itens: String(cssRows.length),
    }),
    [showAllStyles, cssRows.length],
  );

  if (!block) return null;

  return (
    <PropertiesSection
      title="Propriedades CSS"
      defaultOpen={false}
      storageKey="css-props"
      currentValues={currentValues}
    >
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
    </PropertiesSection>
  );
}
