// Talks to the backend over a WebSocket

// The connection is the session: commands are sent over it, and the server answers them
// and sends the events of the session. The server drops the session when the connection
// is lost, so the page reloads once the server is reachable again.

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
  | { type: "event"; name: string; payload: unknown };

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: string) => void;
}

const RECONNECT_DELAY = 5000;
const CONNECTION_LOST = "Connection to the server lost";

let socket: WebSocket | null = null;
let nextId = 0;

let disconnected = false;
const disconnectedListeners = new Set<() => void>();

/** Requests waiting for the connection */
let queue: string[] = [];

/** Requests waiting for their response */
const pending = new Map<number, PendingRequest>();
const handlers = new Map<string, Set<EventHandler>>();

export function invoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (disconnected) return Promise.reject(CONNECTION_LOST);

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

/** Whether the connection to the server got lost. */
export function isDisconnected(): boolean {
  return disconnected;
}

export function subscribeDisconnected(listener: () => void): () => void {
  disconnectedListeners.add(listener);
  return () => disconnectedListeners.delete(listener);
}

/** Returns the connection, and opens it on first use */
function connect(): WebSocket {
  if (socket) return socket;

  const ws = new WebSocket("/api/ws");
  socket = ws;

  ws.onopen = () => {
    // The server dropped the state of this page while it was disconnected
    if (disconnected) {
      window.location.reload();
      return;
    }
    queue.forEach((request) => ws.send(request));
    queue = [];
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
        break;
    }
  };

  ws.onclose = () => {
    socket = null;
    disconnected = true;
    disconnectedListeners.forEach((listener) => listener());

    // Their responses can't arrive anymore
    pending.forEach((request) => request.reject(CONNECTION_LOST));
    pending.clear();

    setTimeout(connect, RECONNECT_DELAY);
  };

  return ws;
}
