import TelegramBot from "node-telegram-bot-api";
import PQueue from "p-queue";
import { env } from "./env.js";

export const bot = new TelegramBot(env.telegramBotToken, { polling: true });

// Telegram global limit: ~30 msg/sec across all chats. Keep some headroom.
const queue = new PQueue({ concurrency: 1, intervalCap: 25, interval: 1000 });

interface SendOpts {
  chatId: number | string;
  text: string;
  imageUrl?: string;
  button?: { text: string; url: string } | null;
}

async function sendOne({ chatId, text, imageUrl, button }: SendOpts): Promise<void> {
  const reply_markup = button
    ? { inline_keyboard: [[{ text: button.text, url: button.url }]] }
    : undefined;

  let attempt = 0;
  while (attempt < 5) {
    try {
      if (imageUrl) {
        await bot.sendPhoto(chatId, imageUrl, {
          caption: text,
          parse_mode: "HTML",
          reply_markup,
        });
      } else {
        await bot.sendMessage(chatId, text, {
          parse_mode: "HTML",
          reply_markup,
          disable_web_page_preview: false,
        });
      }
      return;
    } catch (err: any) {
      const code = err?.response?.body?.error_code ?? err?.code;
      const retryAfter = err?.response?.body?.parameters?.retry_after;
      // 429 — flood control
      if (code === 429 && retryAfter) {
        await new Promise((r) => setTimeout(r, (retryAfter + 1) * 1000));
        attempt++;
        continue;
      }
      // 403 (blocked) / 400 (chat not found) — пропускаем без ретрая
      if (code === 403 || code === 400) throw err;
      // прочие ошибки — экспоненциальная задержка
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      attempt++;
    }
  }
  throw new Error("send failed after retries");
}

export async function broadcast(opts: {
  recipients: number[];
  text: string;
  imageUrl?: string;
  button?: { text: string; url: string } | null;
}): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  await Promise.all(
    opts.recipients.map((chatId) =>
      queue.add(async () => {
        try {
          await sendOne({ chatId, text: opts.text, imageUrl: opts.imageUrl, button: opts.button });
          sent++;
        } catch {
          failed++;
        }
      })
    )
  );
  return { sent, failed };
}

export async function notifyAdmins(text: string): Promise<void> {
  await Promise.all(
    env.adminTgIds.map((id) =>
      queue.add(() =>
        bot.sendMessage(Number(id), text, { parse_mode: "HTML" }).catch(() => undefined)
      )
    )
  );
}

// /start — показать кнопку открытия мини-приложения
bot.onText(/\/start/, async (msg) => {
  try {
    await bot.sendMessage(msg.chat.id, "Открой магазин 👇", {
      reply_markup: {
        inline_keyboard: [[{ text: "🛒 Открыть магазин", web_app: { url: env.webappUrl } }]],
      },
    });
  } catch {}
});
