import { MainMenu } from "./MainMenu.js";
import { GameLauncher } from "./GameLauncher.js";

async function main(): Promise<void> {
  const menu = new MainMenu();
  const selectedDeckId = await menu.show();

  if (!selectedDeckId) {
    console.log("[CardVerse] \u7528\u6237\u53D6\u6D88\u9009\u62E9");
    const appRoot = document.getElementById("app");
    if (appRoot) {
      const msg = document.createElement("div");
      msg.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #888;
        font-family: Arial, sans-serif;
      `;
      const text = document.createElement("p");
      text.textContent = "\u672A\u9009\u62E9\u5361\u5305\uFF0C\u5237\u65B0\u9875\u9762\u91CD\u65B0\u5F00\u59CB";
      text.style.fontSize = "16px";
      msg.appendChild(text);

      const btn = document.createElement("button");
      btn.textContent = "\u91CD\u65B0\u5F00\u59CB";
      btn.style.cssText = `
        margin-top: 16px;
        padding: 8px 20px;
        background: #336644;
        color: #fff;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
      `;
      btn.onclick = () => window.location.reload();
      msg.appendChild(btn);

      appRoot.appendChild(msg);
    }
    return;
  }

  console.log(`[CardVerse] Selected deck: ${selectedDeckId}`);

  const launcher = new GameLauncher(selectedDeckId);
  await launcher.start();
}

main().catch((err) => {
  console.error("Failed to initialize CardVerse UI:", err);
  const container = document.createElement("div");
  container.style.cssText = "color:#f44;padding:40px;font-family:Arial,sans-serif;";
  const heading = document.createElement("h2");
  heading.textContent = "CardVerse \u542F\u52A8\u5931\u8D25";
  const message = document.createElement("p");
  message.textContent = err instanceof Error ? err.message : String(err);
  container.appendChild(heading);
  container.appendChild(message);
  document.body.innerHTML = "";
  document.body.appendChild(container);
});
