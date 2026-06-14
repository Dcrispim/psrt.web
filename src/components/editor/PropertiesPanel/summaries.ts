import { isUniformBorderRadius } from "../../../lib/textBlockAdapter";
import type { Shadow, TextBlock } from "../types";

export function truncateHeaderText(value: string, max = 28): string {
  const trimmed = value.trim();
  if (!trimmed) return "—";
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

export function alignHorizontalShort(value: string): string {
  const labels: Record<string, string> = {
    left: "Esq",
    center: "Centro",
    right: "Dir",
    justify: "Just.",
  };
  return labels[value] ?? value;
}

export function alignVerticalShort(value: string): string {
  const labels: Record<string, string> = {
    "flex-start": "Topo",
    center: "Centro",
    "flex-end": "Base",
  };
  return labels[value] ?? value;
}

export function shadowIsActive(shadow: Shadow): boolean {
  return shadow.top > 0 || shadow.right > 0 || shadow.bottom > 0 || shadow.left > 0;
}

export function summarizeBorderRadius(block: TextBlock, linked: boolean): string {
  const { borderRadius } = block;
  const max = Math.max(
    borderRadius.topLeft,
    borderRadius.topRight,
    borderRadius.bottomLeft,
    borderRadius.bottomRight,
  );
  if (max <= 0) return "0";
  if (linked || isUniformBorderRadius(borderRadius)) return `${borderRadius.topLeft}px`;
  return "Mix";
}

export function summarizeBlur(block: TextBlock, sideUi: string): Record<string, string> {
  if (block.blur.amount <= 0) return { Blur: "Off" };
  if (sideUi === "all") return { Blur: `${block.blur.amount}%` };
  return { Blur: `${block.blur.amount}%`, Lado: sideUi };
}

export function summarizeShadow(shadow: Shadow): Record<string, string> {
  if (!shadowIsActive(shadow)) return { Shadow: "Off" };
  const dist = Math.max(shadow.top, shadow.right, shadow.bottom, shadow.left);
  return {
    Dist: `${dist.toFixed(1)}%`,
    Cor: shadow.color,
  };
}

export function assetRefBasename(ref: string): string {
  const normalized = ref.replace(/\\/g, "/");
  return normalized.split("/").pop() ?? ref;
}
