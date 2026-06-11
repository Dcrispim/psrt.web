/** Browser shim for @wails/runtime with lightweight event bus. */

type Listener = (...data: unknown[]) => void;

const listeners = new Map<string, Set<Listener>>();

export function EventsOnMultiple(
  eventName: string,
  callback: Listener,
  _maxCallbacks?: number,
): () => void {
  return EventsOn(eventName, callback);
}

export function EventsOn(eventName: string, callback: Listener): () => void {
  let set = listeners.get(eventName);
  if (!set) {
    set = new Set();
    listeners.set(eventName, set);
  }
  set.add(callback);
  return () => {
    set!.delete(callback);
  };
}

export function EventsOff(_eventName: string, ..._additionalEventNames: string[]): void {}

export function EventsEmit(eventName: string, ...data: unknown[]): void {
  const set = listeners.get(eventName);
  if (!set) return;
  for (const cb of set) {
    cb(...data);
  }
}
