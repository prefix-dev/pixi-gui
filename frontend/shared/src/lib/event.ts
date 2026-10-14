import type { ConfirmRequest } from "#lib/confirm";
import type { OpenEditorError } from "#lib/editor";
import type { Notification } from "#lib/notification";
import { listen } from "#lib/platform";
import type { PtyDataEvent, PtyExitEvent, PtyStartEvent } from "#lib/pty";

export interface EventMap {
  "pty-start": PtyStartEvent;
  "pty-data": PtyDataEvent;
  "pty-exit": PtyExitEvent;
  "editor-failed": OpenEditorError;
  "confirm-request": ConfirmRequest;
  "notification": Notification;
  "manifest-changed": null;
}

type EventHandler<T = unknown> = (payload: T) => void;

interface EventEntry {
  eventName: string;
  handlers: Set<EventHandler>;
  ready: boolean;
  pendingEvents: unknown[];
}

const registry = new Map<string, EventEntry>();

export function subscribe<K extends keyof EventMap>(
  eventName: K,
  handler: EventHandler<EventMap[K]>,
): () => void {
  const entry = getEntry(eventName);
  entry.handlers.add(handler as EventHandler);

  // If there are pending events that arrived before this handler was added, dispatch them now
  if (entry.pendingEvents.length > 0) {
    for (const payload of entry.pendingEvents) {
      handler(payload as EventMap[K]);
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

  // Setup backend event listener
  listen(eventName, (payload) => {
    // If no handlers are registered yet, queue the event
    if (newEntry.handlers.size === 0) {
      newEntry.pendingEvents.push(payload);
      return;
    }

    const handlers = Array.from(newEntry.handlers);
    for (const handler of handlers) {
      handler(payload);
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
