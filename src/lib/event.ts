import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

type EventHandler<T = unknown> = (payload: T) => void;

interface EventEntry {
  eventName: string;
  handlers: Set<EventHandler>;
  ready: boolean;
  pendingEvents: unknown[];
}

const registry = new Map<string, EventEntry>();

export function subscribe<T = unknown>(
  eventName: string,
  handler: EventHandler<T>,
): () => void {
  const entry = getEntry(eventName);
  entry.handlers.add(handler as EventHandler);

  // If there are pending events that arrived before this handler was added, dispatch them now
  if (entry.pendingEvents.length > 0) {
    for (const payload of entry.pendingEvents) {
      handler(payload as T);
    }
    entry.pendingEvents = [];
  }

  return () => {
    const entry = registry.get(eventName);
    if (!entry) return;

    entry.handlers.delete(handler as EventHandler);
  };
}

function getEntry(eventName: string): EventEntry {
  const entry = registry.get(eventName);
  if (entry) return entry;

  // Entry doesn't exist yet -> create one
  const newEntry: EventEntry = {
    eventName,
    handlers: new Set<EventHandler>(),
    ready: false,
    pendingEvents: [],
  };

  // Add entry to registry immediately so subsequent calls get the same entry
  registry.set(eventName, newEntry);

  // Setup Tauri event listener
  getCurrentWebviewWindow()
    .listen(eventName, (event) => {
      // If no handlers are registered yet, queue the event
      if (newEntry.handlers.size === 0) {
        newEntry.pendingEvents.push(event.payload);
        return;
      }

      const handlers = Array.from(newEntry.handlers);
      for (const handler of handlers) {
        handler(event.payload);
      }
    })
    .then(() => {
      newEntry.ready = true;
    })
    .catch((error) => {
      console.error(`Failed to register listener for "${eventName}":`, error);
    });

  return newEntry;
}
