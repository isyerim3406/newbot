// telegram.js
import fetch from 'node-fetch';

export async function sendTelegramMessage(token, chatId, message) {
  if (!token || !chatId) {
    console.warn('TG_TOKEN or TG_CHAT_ID missing');
    return;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ chat_id: chatId, text: message })
    });
    const j = await res.json();
    if (!j.ok) {
      console.error('Telegram API error', j);
    } else {
      console.log('Telegram message sent:', message);
    }
    return j;
  } catch (e) {
    console.error('Failed to send Telegram message:', e);
  }
}
