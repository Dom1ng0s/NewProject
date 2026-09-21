// Hook "Notification" do Claude Code: avisa no Telegram quando a sessão está
// parada esperando você. Usa só sendMessage, então funciona com o seu bot atual.
// Funciona em Windows, Linux e macOS (só precisa do Node 18+).
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";

const envFile = join(homedir(), ".config", "claude-multiagentes", "telegram.env");
if (!existsSync(envFile)) process.exit(0);
const env = Object.fromEntries(
  readFileSync(envFile, "utf8").split(/\r?\n/).filter(l => l.includes("="))
    .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
if (!env.TELEGRAM_NOTIFY_TOKEN || !env.TELEGRAM_CHAT_ID) process.exit(0);

let entrada = "";
process.stdin.on("data", c => (entrada += c));
process.stdin.on("end", async () => {
  let dados = {};
  try { dados = JSON.parse(entrada || "{}"); } catch {}
  const msg = dados.message || "Claude Code precisa de você";
  const projeto = basename(dados.cwd || process.cwd());
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_NOTIFY_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: `🤖 [${projeto}] ${msg}` }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {}
  process.exit(0);
});
