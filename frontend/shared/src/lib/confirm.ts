import { invoke } from "#lib/platform";

/** Payload of the `confirm-request` event, sent when the backend asks the user a question. */
export interface ConfirmRequest {
  id: number;
  title: string;
  message: string;
  okLabel: string;
  cancelLabel: string;
}

export async function answerConfirm(id: number, value: boolean): Promise<void> {
  await invoke("answer_confirm", { id, value });
}
