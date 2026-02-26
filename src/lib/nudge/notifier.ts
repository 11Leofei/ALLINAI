import notifier from "node-notifier";

export function sendNotification(title: string, message: string): void {
  try {
    notifier.notify({
      title,
      message,
      sound: "Ping",
      wait: false,
    });
  } catch {
    // Silently fail if notification can't be sent
    console.warn("Failed to send notification:", message);
  }
}
