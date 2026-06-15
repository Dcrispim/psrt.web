import { useState, type ReactNode } from "react";
import s from "./sidebar.module.css";
import { IconChevron, IconPin } from "./icons";

const STORAGE_PREFIX = "psrt-sidebar-section-";
export const MAX_OPEN_SECTIONS = 2;
export const OPEN_SECTIONS_QUEUE_KEY = "psrt-sidebar-open-sections";

function readStored(key: string, defaultOpen: boolean): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (raw === null) return defaultOpen;
    return raw === "1";
  } catch {
    return defaultOpen;
  }
}

function writeStored(key: string, open: boolean): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, open ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}

export function readOpenSectionsQueue(fallback: string[] = ["Posição & Tamanho"]): string[] {
  try {
    const raw = localStorage.getItem(OPEN_SECTIONS_QUEUE_KEY);
    if (!raw) return fallback.slice(0, MAX_OPEN_SECTIONS);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return fallback.slice(0, MAX_OPEN_SECTIONS);
    return parsed
      .filter((item): item is string => typeof item === "string" && item.length > 0)
      .slice(-MAX_OPEN_SECTIONS);
  } catch {
    return fallback.slice(0, MAX_OPEN_SECTIONS);
  }
}

export function persistOpenSectionsQueue(queue: string[]): void {
  try {
    localStorage.setItem(OPEN_SECTIONS_QUEUE_KEY, JSON.stringify(queue.slice(-MAX_OPEN_SECTIONS)));
  } catch {
    /* ignore */
  }
}

/** Keeps at most `MAX_OPEN_SECTIONS` titles; newest opened section wins. */
export function nextOpenSectionsQueue(prev: string[], title: string, open: boolean): string[] {
  if (!open) return prev.filter((t) => t !== title);
  const without = prev.filter((t) => t !== title);
  const next = [...without, title];
  if (next.length <= MAX_OPEN_SECTIONS) return next;
  return next.slice(-MAX_OPEN_SECTIONS);
}

export interface SectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  storageKey?: string;
  currentValues?: Record<string, string>;
  queue?: string[];
  pushQueue?: (title: string, open: boolean) => void;
  togglePin?: (title: string) => void;
  isPinned?: boolean;
}

export function Section({
  title,
  queue,
  children,
  defaultOpen = true,
  storageKey,
  currentValues,
  pushQueue,
  togglePin,
  isPinned,
}: SectionProps) {
  const key = storageKey ?? title.toLowerCase().replace(/\s+/g, "-");
  const controlled = queue !== undefined && pushQueue !== undefined;
  const [localOpen, setLocalOpen] = useState(() => readStored(key, defaultOpen));
  const isOpen = controlled ? queue.includes(title) : localOpen;

  const toggle = () => {
    const next = !isOpen;
    if (controlled) {
      pushQueue(title, next);
      return;
    }
    setLocalOpen(next);
    writeStored(key, next);
  };

  return (
    <div className={s.section}>
      <button
        type="button"
        className={s.sectionHeader}
        onClick={toggle}
        aria-expanded={isOpen}
      >
        <span>{title}

          <span className={s.pin} onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePin?.(title)
          }}>
            <IconPin size={14} className={isPinned ? s.pinned : undefined} />
          </span>

        </span>

        {currentValues && !isOpen ? (
          <div className={s.sectionCurrentValues}>
            {Object.entries(currentValues).map(([entryKey, value]) => (
              <div key={entryKey}>
                {entryKey}: {value}
              </div>
            ))}
          </div>
        ) : null}
        <span className={`${s.chev} ${isOpen ? s.chevOpen : ""}`}>
          <IconChevron />
        </span>
      </button>

      {isOpen ? <div className={s.sectionBody}>{children}</div> : null}
    </div>
  );
}
