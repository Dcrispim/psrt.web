import type { Dispatch, RefObject, SetStateAction } from "react";
import type { InlineWrapKind } from "../../../lib/inlineMarkup";
import type { Blur, BlurSide, BorderRadius, Shadow, TextBlock } from "../types";

export interface PropertiesPanelProps {
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

export interface PropertiesPanelContextValue {
  blocks: TextBlock[];
  activeId: string;
  block: TextBlock | undefined;
  isMask: boolean;
  textContent: string;
  onTextContentChange: (value: string) => void;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onChange: (updater: (b: TextBlock) => TextBlock) => void;
  onPatchStyle: PropertiesPanelProps["onPatchStyle"];
  onPatchStyleProp: PropertiesPanelProps["onPatchStyleProp"];
  onTypographyWrap?: PropertiesPanelProps["onTypographyWrap"];
  fontOptions: { value: string; label: string }[];
  contentTextareaRef: RefObject<HTMLTextAreaElement | null>;
  setField: <K extends keyof TextBlock>(key: K, value: TextBlock[K]) => void;
  setFont: <K extends keyof TextBlock["font"]>(key: K, value: TextBlock["font"][K]) => void;
  setAlign: <K extends keyof TextBlock["align"]>(key: K, value: TextBlock["align"][K]) => void;
  tryInlineOrBlock: (kind: InlineWrapKind, blockToggle: () => void) => void;
  draftProps: { key: string; value: string }[];
  setDraftProps: Dispatch<SetStateAction<{ key: string; value: string }[]>>;
  showAllStyles: boolean;
  setShowAllStyles: Dispatch<SetStateAction<boolean>>;
  expandedPropIndex: number | null;
  setExpandedPropIndex: Dispatch<SetStateAction<number | null>>;
  editingPropIndex: number | null;
  setEditingPropIndex: Dispatch<SetStateAction<number | null>>;
  editingKeyBeforeRef: RefObject<string | null>;
  cssPropKeyListId: string;
  cssRows: { key: string; value: string }[];
  updatePropRowDraft: (index: number, patch: Partial<{ key: string; value: string }>) => void;
  patchPropValue: (key: string, value: string) => void;
  commitDraftRow: (index: number, previousKey?: string | null) => void;
  radiusLinked: boolean;
  setRadiusLinked: Dispatch<SetStateAction<boolean>>;
  setBorderRadius: (patch: Partial<BorderRadius>) => void;
  setUniformRadius: (value: number) => void;
  resetBorderRadius: () => void;
  enableUnifiedRadius: () => void;
  blurSideUi: string;
  setBlurSide: (side: BlurSide) => void;
  setBlurAmount: (amount: number) => void;
  resetBlur: () => void;
  shadowLinked: boolean;
  setShadowLinked: Dispatch<SetStateAction<boolean>>;
  shadowColorDraft: string;
  setShadow: (patch: Partial<Shadow>) => void;
  resetShadow: () => void;
  setUniformShadow: (amount: number) => void;
  enableUnifiedShadow: () => void;
  applyBlur: (blur: Blur) => void;
}
