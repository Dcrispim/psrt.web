import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { nextOpenSectionsQueue, persistOpenSectionsQueue, readOpenSectionsQueue } from "../Sections";

export interface SectionQueueContextValue {
  openQueue: string[];
  pushQueue: (title: string, open: boolean) => void;
  togglePin: (title: string) => void;
  pinOpened: string[];
}

const SectionQueueContext = createContext<SectionQueueContextValue | null>(null);

export function useSectionQueue(): SectionQueueContextValue {
  const ctx = useContext(SectionQueueContext);
  if (!ctx) {
    throw new Error("useSectionQueue must be used within SectionQueueProvider");
  }
  return ctx;
}

export function SectionQueueProvider({ children }: { children: ReactNode }) {
  const [openQueue, setOpenQueue] = useState<string[]>(() => readOpenSectionsQueue());
  const [pinOpened, setPinOpened] = useState<string[]>(() => readOpenSectionsQueue());

  const pushQueue = useCallback((title: string, open: boolean) => {
    setOpenQueue((prev) => {
      const next = nextOpenSectionsQueue(prev, title, open);
      persistOpenSectionsQueue(next);
      return next;
    });
  }, []);

  const togglePin = useCallback((title: string) => {
    setPinOpened((prev) => {
      const next = prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title];
      persistOpenSectionsQueue(next);
      return next;
    });
  }, []);

  const mergedOpenQueue = useMemo(
    () => [...new Set([...openQueue, ...pinOpened])],
    [openQueue, pinOpened],
  );

  const value = useMemo<SectionQueueContextValue>(
    () => ({
      openQueue: mergedOpenQueue,
      pushQueue,
      togglePin,
      pinOpened,
    }),
    [mergedOpenQueue, pushQueue, togglePin],
  );

  return <SectionQueueContext.Provider value={value}>{children}</SectionQueueContext.Provider>;
}
