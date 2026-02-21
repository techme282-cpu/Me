// Push notification permission and display helper
// Uses the browser Notification API for real notifications

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.log("Notifications not supported");
    return false;
  }
  
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function showBrowserNotification(title: string, options?: {
  body?: string;
  icon?: string;
  tag?: string;
  data?: any;
}) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  
  try {
    const notification = new Notification(title, {
      body: options?.body || "",
      icon: options?.icon || "/favicon.ico",
      tag: options?.tag,
      data: options?.data,
      badge: "/favicon.ico",
    });
    
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Fallback: some environments don't support Notification constructor
  }
}
