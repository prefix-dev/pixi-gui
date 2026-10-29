export interface Notification {
  level: "info" | "success" | "warning" | "error";
  message: string;
}
