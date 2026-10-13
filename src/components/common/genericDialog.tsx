import { type FormEvent, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";

/** Shows a message with an "OK" button. */
export function showMessage(title: string, message: string): Promise<void> {
  return new Promise((resolve) =>
    enqueue({
      kind: "message",
      title,
      message,
      okLabel: "OK",
      resolve: () => resolve(),
    }),
  );
}

/** Asks the user to confirm a message. */
export function showConfirm(
  title: string,
  message: string,
  okLabel = "OK",
  cancelLabel = "Cancel",
): Promise<boolean> {
  return new Promise((resolve) =>
    enqueue({
      kind: "confirm",
      title,
      message,
      okLabel,
      cancelLabel,
      resolve: (ok) => resolve(ok),
    }),
  );
}

/** Asks the user to enter a text. */
export function showPrompt(
  title: string,
  message: string,
  defaultValue = "",
  okLabel = "OK",
  cancelLabel = "Cancel",
): Promise<string | null> {
  return new Promise((resolve) =>
    enqueue({
      kind: "prompt",
      title,
      message,
      defaultValue,
      okLabel,
      cancelLabel,
      resolve: (ok, text) => resolve(ok ? text : null),
    }),
  );
}

interface DialogRequest {
  id: number;
  kind: "confirm" | "message" | "prompt";
  title: string;
  message: string;
  defaultValue?: string;
  okLabel: string;
  cancelLabel?: string;
  resolve: (ok: boolean, text: string) => void;
}

let nextId = 0;
let queue: DialogRequest[] = [];
const listeners = new Set<() => void>();

function enqueue(request: Omit<DialogRequest, "id">) {
  queue = [...queue, { ...request, id: nextId++ }];
  listeners.forEach((listener) => listener());
}

function dequeue() {
  queue = queue.slice(1);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function GenericDialogHost() {
  const current = useSyncExternalStore(subscribe, () => queue[0]);
  if (!current) return null;

  return <GenericDialog key={current.id} request={current} />;
}

function GenericDialog({ request }: { request: DialogRequest }) {
  const [text, setText] = useState(request.defaultValue ?? "");

  const close = (ok: boolean) => {
    dequeue();
    request.resolve(ok, text);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    close(true);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && close(false)}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{request.title}</DialogTitle>
            <DialogDescription>{request.message}</DialogDescription>
          </DialogHeader>
          {request.kind === "prompt" && (
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label={request.title}
              autoFocus
            />
          )}
          <DialogFooter>
            {request.cancelLabel && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => close(false)}
              >
                {request.cancelLabel}
              </Button>
            )}
            <Button type="submit" autoFocus={request.kind !== "prompt"}>
              {request.okLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
