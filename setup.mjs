// Configura a pasta para a estrutura multiagentes do Claude Code.
// Uso: node setup.mjs   (Windows, Linux ou macOS). Pode rodar mais de uma vez.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const pasta = dirname(fileURLToPath(import.meta.url));
process.chdir(pasta);
const WIN = process.platform === "win32";
const ok = m => console.log(`\x1b[32m✔\x1b[0m ${m}`);
const aviso = m => console.log(`\x1b[33m!\x1b[0m ${m}`);
const erro = m => console.log(`\x1b[31m✘\x1b[0m ${m}`);
const titulo = m => console.log(`\n\x1b[1m== ${m} ==\x1b[0m`);
const rodar = (cmd, silencioso = true) =>
  spawnSync(cmd, { shell: true, stdio: silencioso ? "pipe" : ["ignore", "inherit", "inherit"], encoding: "utf8" });
const existe = cmd => rodar(`${cmd} --version`).status === 0;

// Cada pergunta abre e fecha a própria leitura do teclado.
// Isso evita o travamento do terminal do Windows depois de rodar outros comandos.
const perguntar = q => new Promise(res => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(q, a => { rl.close(); res(a.trim()); });
});
// Entrada oculta: mostra * a cada caractere (colar com botão direito ou Ctrl+V funciona).
const secreto = q => new Promise(res => {
  process.stdout.write(q);
  const entrada = process.stdin;
  if (entrada.isTTY) entrada.setRawMode(true);
  entrada.setEncoding("utf8");
  entrada.resume();
  let valor = "";
  const aoDigitar = pedaco => {
    for (const c of pedaco) {
      if (c === "\r" || c === "\n") {
        entrada.removeListener("data", aoDigitar);
        if (entrada.isTTY) entrada.setRawMode(false);
        entrada.pause();
        process.stdout.write("\n");
        return res(valor.trim());
      } else if (c === "\u0003") { process.stdout.write("\n"); process.exit(1); }
      else if (c === "\u007f" || c === "\b") { if (valor) { valor = valor.slice(0, -1); process.stdout.write("\b \b"); } }
      else if (c >= " ") { valor += c; process.stdout.write("*"); }
    }
  };
  entrada.on("data", aoDigitar);
});
const sim = async q => /^s/i.test(await perguntar(`${q} [s/N] `));
const salvar = (arquivo, conteudo) => {
  mkdirSync(dirname(arquivo), { recursive: true });
  writeFileSync(arquivo, conteudo);
  if (!WIN) chmodSync(arquivo, 0o600);
};
const tg = async (token, metodo, corpo) => {
  const r = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo || {}),
  });
  return r.json();
};

// 1. Dependências
titulo("1/6 Dependências");
let falta = false;
for (const [cmd, nome] of [["git", "Git"], ["claude", "Claude Code"]]) {
  if (existe(cmd)) ok(nome); else { erro(`${nome} não encontrado`); falta = true; }
}
const nodeMaior = Number(process.versions.node.split(".")[0]);
nodeMaior >= 20 ? ok(`Node ${nodeMaior}`) : aviso(`Node ${nodeMaior}: recomendo 20 ou mais`);
if (existe("bun")) ok("Bun");
else {
  aviso("Bun não encontrado (necessário para conversar pelo Telegram).");
  if (await sim("Instalar o Bun agora?")) {
    rodar(WIN ? `powershell -NoProfile -c "irm bun.sh/install.ps1 | iex"` : "curl -fsSL https://bun.sh/install | bash", false);
    aviso("Feche e abra o terminal depois do setup para o Bun ser reconhecido.");
  }
}
existe("gh") ? ok("GitHub CLI") : aviso(`GitHub CLI não encontrado (opcional). Instale com: ${WIN ? "winget install GitHub.cli" : "https://cli.github.com"}`);
if (falta) { erro("Instale o que falta e rode de novo."); process.exit(1); }

// 2. Repositório
titulo("2/6 Repositório");
if (!existsSync(".git")) { rodar("git init -b main"); ok("git init"); } else ok("repositório já existe");
if (!existsSync(".gitignore")) {
  writeFileSync(".gitignore", "node_modules/\ndist/\nbuild/\ncoverage/\n.env\n.env.*\n*.local\n.DS_Store\nThumbs.db\n");
  ok(".gitignore criado");
}

// 3. Avisos pelo bot atual
titulo("3/6 Avisos pelo seu bot atual do Telegram");
const confNotif = join(homedir(), ".config", "claude-multiagentes", "telegram.env");
if (existsSync(confNotif)) ok("já configurado");
else if (await sim("Configurar avisos pelo seu bot atual?")) {
  const token = await secreto("Token do bot atual (não aparece na tela): ");
  let chat = await perguntar("Seu chat_id (Enter para eu tentar descobrir): ");
  if (!chat) {
    await perguntar("Mande qualquer mensagem para o bot no Telegram e pressione Enter...");
    try {
      const r = await tg(token, "getUpdates");
      chat = r.ok ? String(r.result.map(u => u.message?.chat?.id).filter(Boolean).pop() || "") : "";
      if (!r.ok) aviso(`O Telegram recusou (${r.description}). Isso acontece se o seu bot já está rodando.`);
    } catch { chat = ""; }
  }
  if (!chat) {
    aviso("Não descobri o chat_id. Alternativa: mande /start para @userinfobot no Telegram, ele responde com o seu id.");
    chat = await perguntar("Digite o chat_id (ou Enter para pular): ");
  }
  if (chat) {
    salvar(confNotif, `TELEGRAM_NOTIFY_TOKEN=${token}\nTELEGRAM_CHAT_ID=${chat}\n`);
    const r = await tg(token, "sendMessage", { chat_id: chat, text: `✅ Avisos do projeto ${basename(pasta)} configurados.` }).catch(() => ({}));
    r.ok ? ok("salvo. Chegou uma mensagem de teste no Telegram.") : aviso("salvo, mas o envio de teste falhou. Confira o token e o chat_id.");
  }
}

// 4. Canal de conversa (bot dedicado)
titulo("4/6 Conversa pelo Telegram (bot NOVO e dedicado)");
const confCanal = join(homedir(), ".claude", "channels", "telegram", ".env");
if (existsSync(confCanal)) ok("token do canal já configurado");
else if (await sim("Configurar o canal agora? (tenha em mãos o token do bot novo)")) {
  rodar("claude plugin marketplace add anthropics/claude-plugins-official");
  rodar("claude plugin install telegram@claude-plugins-official").status === 0
    ? ok("plugin instalado")
    : aviso("Não consegui instalar pela linha de comando. Dentro do Claude Code rode: /plugin install telegram@claude-plugins-official");
  const token = await secreto("Token do bot NOVO (não aparece na tela): ");
  salvar(confCanal, `TELEGRAM_BOT_TOKEN=${token}\n`);
  ok("token salvo. O pareamento é feito ao abrir o Claude Code (veja o fim deste setup).");
}

// 5. Primeiro commit
titulo("5/6 Primeiro commit");
if (rodar("git log -1").status !== 0) {
  rodar("git add -A"); rodar(`git commit -m "chore: estrutura multiagentes inicial"`);
  ok("commit criado");
} else ok("já há commits");

// 6. GitHub
titulo("6/6 GitHub");
if (rodar("git remote get-url origin").status === 0) ok(`remoto: ${rodar("git remote get-url origin").stdout.trim()}`);
else if (existe("gh") && rodar("gh auth status").status === 0) {
  if (await sim("Criar um repositório PRIVADO no GitHub e enviar o código?")) {
    rodar(`gh repo create "${basename(pasta)}" --private --source . --push`, false);
  }
} else {
  aviso("O projeto precisa estar no GitHub para o link de teste funcionar.");
  console.log("   Opção A: instale o GitHub CLI, rode 'gh auth login' e depois 'node setup.mjs' de novo.");
  console.log("   Opção B: crie um repositório PRIVADO vazio em github.com/new e rode:");
  console.log(`      git remote add origin https://github.com/SEU_USUARIO/${basename(pasta)}.git`);
  console.log("      git push -u origin main");
}

console.log("\n\x1b[1mPronto. Próximos passos:\x1b[0m");
console.log(`  1. ${WIN ? "Dê dois cliques em iniciar.cmd (ou rode .\\iniciar.cmd)" : "Rode: claude --channels plugin:telegram@claude-plugins-official"}`);
console.log("  2. Mande qualquer mensagem ao bot NOVO; ele responde com um código");
console.log("  3. No Claude Code: /telegram:access pair <código>");
console.log("  4. Depois: /telegram:access policy allowlist");
console.log("  5. Por fim: /construir");
process.exit(0);
