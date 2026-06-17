import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { InlineWrapKind } from "../../../lib/inlineMarkup";
import {
  allStyleRowsFromBlock,
  blurStylePatch,
  borderRadiusStylePatch,
  isUniformBorderRadius,
  isUniformShadow,
  shadowStylePatch,
} from "../../../lib/textBlockAdapter";
import {
  ZERO_BLUR,
  ZERO_BORDER_RADIUS,
  ZERO_SHADOW,
  type Blur,
  type BlurSide,
  type BorderRadius,
  type Shadow,
  type TextBlock,
} from "../types";
import { shadowIsActive } from "./summaries";
import type { PropertiesPanelContextValue, PropertiesPanelProps } from "./types";
import { logger } from "../../../api/logger";
import { useEditor } from "../../../context/useEditor";

const PropertiesPanelContext = createContext<PropertiesPanelContextValue | null>(null);

export function usePropertiesPanel(): PropertiesPanelContextValue {
  const ctx = useContext(PropertiesPanelContext);
  if (!ctx) {
    logger('propertiesPanel', {
      error: 'usePropertiesPanel must be used within PropertiesPanelProvider',
    });
    throw new Error("usePropertiesPanel must be used within PropertiesPanelProvider");
  }
  return ctx;
}

export function PropertiesPanelProvider({
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
  children,
}: PropertiesPanelProps & { children: ReactNode }) {

  const { moveBlockOrder } = useEditor();

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

  const setField = useCallback(
    <K extends keyof TextBlock>(key: K, value: TextBlock[K]) =>
      onChange((b) => ({ ...b, [key]: value })),
    [onChange],
  );

  const setFont = useCallback(
    <K extends keyof TextBlock["font"]>(key: K, value: TextBlock["font"][K]) =>
      onChange((b) => ({ ...b, font: { ...b.font, [key]: value } })),
    [onChange],
  );

  const setAlign = useCallback(
    <K extends keyof TextBlock["align"]>(key: K, value: TextBlock["align"][K]) =>
      onChange((b) => ({ ...b, align: { ...b.align, [key]: value } })),
    [onChange],
  );

  const tryInlineOrBlock = useCallback(
    (kind: InlineWrapKind, blockToggle: () => void) => {
      const ta = contentTextareaRef.current;
      if (ta && ta.selectionStart !== ta.selectionEnd && onTypographyWrap?.(kind, ta)) {
        return;
      }
      blockToggle();
    },
    [onTypographyWrap],
  );

  const updatePropRowDraft = useCallback(
    (index: number, patch: Partial<{ key: string; value: string }>) => {
      setDraftProps((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...patch };
        return next;
      });
    },
    [],
  );

  const patchPropValue = useCallback(
    (key: string, value: string) => {
      const k = key.trim();
      if (!k) return;
      onPatchStyleProp(k, value || null);
    },
    [onPatchStyleProp],
  );

  const commitDraftRow = useCallback(
    (index: number, previousKey?: string | null) => {
      const row = draftProps[index];
      const key = row?.key.trim();
      if (!key) return;
      const prev = previousKey?.trim();
      if (prev && prev !== key) {
        onPatchStyleProp(prev, null);
      }
      onPatchStyleProp(key, row.value || null);
    },
    [draftProps, onPatchStyleProp],
  );

  const applyBorderRadius = useCallback(
    (r: BorderRadius) => {
      onPatchStyle(borderRadiusStylePatch(r));
    },
    [onPatchStyle],
  );

  const setBorderRadius = useCallback(
    (patch: Partial<BorderRadius>) => {
      if (!block) return;
      applyBorderRadius({ ...block.borderRadius, ...patch });
    },
    [applyBorderRadius, block],
  );

  const setUniformRadius = useCallback(
    (value: number) => {
      applyBorderRadius({
        topLeft: value,
        topRight: value,
        bottomRight: value,
        bottomLeft: value,
      });
    },
    [applyBorderRadius],
  );

  const resetBorderRadius = useCallback(() => {
    applyBorderRadius({ ...ZERO_BORDER_RADIUS });
  }, [applyBorderRadius]);

  const enableUnifiedRadius = useCallback(() => {
    setRadiusLinked(true);
    if (!block) return;
    const { topLeft, topRight, bottomRight, bottomLeft } = block.borderRadius;
    const v = Math.max(topLeft, topRight, bottomRight, bottomLeft);
    if (!isUniformBorderRadius(block.borderRadius)) {
      setUniformRadius(v);
    }
  }, [block, setUniformRadius]);

  const applyBlur = useCallback(
    (blur: Blur) => {
      onPatchStyle(blurStylePatch(blur));
    },
    [onPatchStyle],
  );

  const setBlurSide = useCallback(
    (side: BlurSide) => {
      if (!block) return;
      applyBlur({ ...block.blur, side });
    },
    [applyBlur, block],
  );

  const setBlurAmount = useCallback(
    (amount: number) => {
      if (!block) return;
      applyBlur({ ...block.blur, amount });
    },
    [applyBlur, block],
  );

  const resetBlur = useCallback(() => {
    applyBlur({ ...ZERO_BLUR });
  }, [applyBlur]);

  const applyShadow = useCallback(
    (shadow: Shadow) => {
      if (!block) return;
      onPatchStyle(shadowStylePatch(shadow, block.kind));
    },
    [block, onPatchStyle],
  );

  const rememberedShadowColor = useCallback(
    () => (block ? shadowColorByBlockRef.current.get(block.id) ?? shadowColorDraft : shadowColorDraft),
    [block, shadowColorDraft],
  );

  const setShadow = useCallback(
    (patch: Partial<Shadow>) => {
      if (!block) return;
      const color = patch.color ?? rememberedShadowColor();
      if (patch.color !== undefined) {
        shadowColorByBlockRef.current.set(block.id, patch.color);
        setShadowColorDraft(patch.color);
      }
      const next: Shadow = { ...block.shadow, ...patch, color };
      if (!shadowIsActive(next)) return;
      applyShadow(next);
    },
    [applyShadow, block, rememberedShadowColor],
  );

  const resetShadow = useCallback(() => {
    if (!block) return;
    shadowColorByBlockRef.current.set(block.id, shadowColorDraft);
    applyShadow({ ...ZERO_SHADOW });
  }, [applyShadow, block, shadowColorDraft]);

  const setUniformShadow = useCallback(
    (amount: number) => {
      if (!block) return;
      const color = rememberedShadowColor();
      applyShadow({
        ...block.shadow,
        top: amount,
        right: amount,
        bottom: amount,
        left: amount,
        color,
      });
    },
    [applyShadow, block, rememberedShadowColor],
  );

  const enableUnifiedShadow = useCallback(() => {
    setShadowLinked(true);
    if (!block) return;
    const { top, right, bottom, left } = block.shadow;
    const v = Math.max(top, right, bottom, left);
    if (!isUniformShadow(block.shadow)) {
      setUniformShadow(v);
    }
  }, [block, setUniformShadow]);

  const resolvedFontOptions = useMemo(
    () =>
      fontOptions?.length
        ? fontOptions
        : [
            { value: "Inter", label: "Inter" },
            { value: "Roboto", label: "Roboto" },
            { value: "system-ui", label: "Sistema" },
          ],
    [fontOptions],
  );

  const cssRows = block
    ? showAllStyles
      ? allStyleRowsFromBlock(block)
      : draftProps
    : [];




  const value = useMemo<PropertiesPanelContextValue>(
    () => ({
      blocks,
      activeId,
      block,
      isMask: block?.kind === "mask",
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
      fontOptions: resolvedFontOptions,
      contentTextareaRef,
      setField,
      setFont,
      setAlign,
      tryInlineOrBlock,
      draftProps,
      setDraftProps,
      showAllStyles,
      setShowAllStyles,
      expandedPropIndex,
      setExpandedPropIndex,
      editingPropIndex,
      setEditingPropIndex,
      editingKeyBeforeRef,
      cssPropKeyListId,
      cssRows,
      updatePropRowDraft,
      patchPropValue,
      commitDraftRow,
      radiusLinked,
      setRadiusLinked,
      setBorderRadius,
      setUniformRadius,
      resetBorderRadius,
      enableUnifiedRadius,
      blurSideUi: block?.blur.side || "all",
      setBlurSide,
      setBlurAmount,
      resetBlur,
      shadowLinked,
      setShadowLinked,
      shadowColorDraft,
      setShadow,
      resetShadow,
      setUniformShadow,
      enableUnifiedShadow,
      applyBlur,
      moveBlockOrder,
    }),
    [
      blocks,
      activeId,
      block,
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
      resolvedFontOptions,
      setField,
      setFont,
      setAlign,
      tryInlineOrBlock,
      draftProps,
      showAllStyles,
      expandedPropIndex,
      editingPropIndex,
      cssPropKeyListId,
      cssRows,
      updatePropRowDraft,
      patchPropValue,
      commitDraftRow,
      radiusLinked,
      setBorderRadius,
      setUniformRadius,
      resetBorderRadius,
      enableUnifiedRadius,
      setBlurSide,
      setBlurAmount,
      resetBlur,
      shadowLinked,
      shadowColorDraft,
      setShadow,
      resetShadow,
      setUniformShadow,
      enableUnifiedShadow,
      applyBlur,
      moveBlockOrder,
    ],
  );

  return (
    <PropertiesPanelContext.Provider value={value}>{children}</PropertiesPanelContext.Provider>
  );
}
