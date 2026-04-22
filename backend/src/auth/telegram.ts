import crypto from "node:crypto";
import { env } from "../env.js";

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

/**
 * Validates Telegram WebApp initData per official spec:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Returns parsed user object if signature OK, null otherwise.
 */
export function validateInitData(initData: string): TelegramUser | null {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;
    params.delete("hash");

    const dataCheckString = [...params.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(env.telegramBotToken)
      .digest();

    const computed = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (computed !== hash) return null;

    // Optional: reject too-old initData (>24h)
    const authDate = Number(params.get("auth_date") ?? 0);
    if (authDate && Date.now() / 1000 - authDate > 86400) return null;

    const userJson = params.get("user");
    if (!userJson) return null;
    return JSON.parse(userJson) as TelegramUser;
  } catch {
    return null;
  }
}

export function isAdminTgId(tgId: bigint): boolean {
  return env.adminTgIds.some((id: bigint) => id === tgId);
}
