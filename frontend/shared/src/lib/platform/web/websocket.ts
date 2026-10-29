import { v4 as uuidv4 } from "uuid";

import type { ConnectionStatus } from "#lib/platform";

// Talks to the backend over a WebSocket

// The frontend creates the session id, and keeps it across reloads, so the session
// can remain active. If the connection is lost, the server keeps the session for a,
// while so the frontend can connect again.

type EventHandler = (payload: unknown) => void;

/** Sent by the frontend */
interface FrontendMessage {
  id: number;
  cmd: string;
  args: Record<string, unknown>;
}

/** Sent by the server */
type ServerMessage =
  | {
      type: "response";
      id: number;
      result: { Ok: unknown } | { Err: string };
    }
  | { type: "event"; name: string; payload: unknown }
  | { type: "login"; login: string };

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: string) => void;
}

const RECONNECT_DELAY = 5000;
const CLOSE_UNAUTHORIZED = 4001;
const CONNECTION_LOST = "Connection to the server lost";

const token = takeToken();
const LOGIN_KEY = "login";

const SESSION_KEY = "session";
const sessionId = takeSessionId();

let socket: WebSocket | null = null;
let nextId = 0;

let status: ConnectionStatus = "connected";
const statusListeners = new Set<() => void>();

/** Requests waiting for the connection */
let queue: string[] = [];

/** Requests waiting for their response */
const pending = new Map<number, PendingRequest>();
const handlers = new Map<string, Set<EventHandler>>();

/** Whether the session has running processes, so closing the tab asks first */
let hasRunningProcesses = false;
let refreshId = 0;

export function invoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (status !== "connected") return Promise.reject(CONNECTION_LOST);

  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });

    const message: FrontendMessage = { id, cmd, args: args ?? {} };
    const request = JSON.stringify(message);
    const ws = connect();

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(request);
    } else {
      queue.push(request);
    }
  });
}

export function listen<T>(
  event: string,
  handler: (payload: T) => void,
): Promise<() => void> {
  connect();

  let set = handlers.get(event);
  if (!set) {
    set = new Set();
    handlers.set(event, set);
  }
  set.add(handler as EventHandler);

  return Promise.resolve(() => set.delete(handler as EventHandler));
}

export function connectionStatus(): ConnectionStatus {
  return status;
}

export function subscribeConnectionStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

/** Returns the connection, and opens it on first use */
function connect(): WebSocket {
  if (socket) return socket;

  const params = new URLSearchParams();
  if (token) params.set("token", token);

  const login = localStorage.getItem(LOGIN_KEY);
  if (login) params.set("login", login);

  params.set("session", sessionId);

  const ws = new WebSocket(`/api/ws?${params}`);
  socket = ws;

  ws.onopen = () => {
    // Events got lost while disconnected, so the page reloads to get the current state
    if (status === "disconnected") {
      window.location.reload();
      return;
    }
    queue.forEach((request) => ws.send(request));
    queue = [];

    window.addEventListener("beforeunload", (event) => {
      if (hasRunningProcesses && status === "connected") event.preventDefault();
    });
    void refreshRunningProcesses();
  };

  ws.onmessage = (message) => {
    const data = JSON.parse(message.data as string) as ServerMessage;

    switch (data.type) {
      case "response": {
        const request = pending.get(data.id);
        if (!request) break;
        pending.delete(data.id);

        if ("Err" in data.result) {
          request.reject(data.result.Err);
        } else {
          request.resolve(data.result.Ok);
        }
        break;
      }
      case "event":
        handlers.get(data.name)?.forEach((handler) => handler(data.payload));
        if (data.name === "pty-start" || data.name === "pty-exit") {
          void refreshRunningProcesses();
        }
        break;
      case "login":
        localStorage.setItem(LOGIN_KEY, data.login);
        break;
    }
  };

  ws.onclose = (event) => {
    socket = null;

    if (event.code === CLOSE_UNAUTHORIZED) {
      localStorage.removeItem(LOGIN_KEY);
      status = "unauthorized";
    } else {
      status = "disconnected";
      setTimeout(connect, RECONNECT_DELAY);
    }
    statusListeners.forEach((listener) => listener());

    // Their responses can't arrive anymore
    pending.forEach((request) => request.reject(CONNECTION_LOST));
    pending.clear();
  };

  return ws;
}

/**
 * Asks the server whether processes are running. Answers can arrive out of order, as
 * commands run in parallel, so only the answer to the latest request counts.
 */
async function refreshRunningProcesses(): Promise<void> {
  const id = ++refreshId;
  try {
    const ptys = await invoke<unknown[]>("pty_list");
    if (id === refreshId) hasRunningProcesses = ptys.length > 0;
  } catch {
    // Keeps the last known state, e.g. while disconnected
  }
}

function takeToken(): string | null {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("token");
  if (token) {
    url.searchParams.delete("token");
    window.history.replaceState(window.history.state, "", url);
  }
  return token;
}

/** Returns the session id of the previous page if this is a reload, or a new one */
function takeSessionId(): string {
  const id = sessionStorage.getItem(SESSION_KEY) ?? uuidv4();
  sessionStorage.removeItem(SESSION_KEY);

  // Hands the id over to the next page in this tab, in case this one reloads
  window.addEventListener("pagehide", () => {
    sessionStorage.setItem(SESSION_KEY, id);
  });

  // When restored from the back/forward cache, this page keeps running with its session
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) sessionStorage.removeItem(SESSION_KEY);
  });

  return id;
}
