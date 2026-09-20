export async function sendTelegram(text: string): Promise<{ ok: boolean; stub: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: true, stub: true };

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, stub: false, error: `Telegram ${res.status}: ${body.slice(0, 200)}` };
  }
  return { ok: true, stub: false };
}
