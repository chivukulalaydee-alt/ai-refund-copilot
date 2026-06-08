(function () {
  "use strict";

  const API_ENDPOINT = "https://ai-refund-copilot-iige.vercel.app/api/generate-email";
  const BUTTON_CLASS = "ai-refund-btn";
  const RESULT_CLASS = "ai-refund-result";
  const LIMIT_MSG_CLASS = "ai-refund-limit-msg";

  // 用户唯一标识
  let userUUID = null;

  // 获取或生成 User UUID（兼容非扩展环境）
  function getOrCreateUUID() {
    return new Promise((resolve) => {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get("user_uuid", (result) => {
          if (result.user_uuid) {
            resolve(result.user_uuid);
          } else {
            const newUUID = crypto.randomUUID();
            chrome.storage.local.set({ user_uuid: newUUID }, () => {
              resolve(newUUID);
            });
          }
        });
      } else {
        // 本地测试环境：使用 localStorage 作为后备
        let uuid = localStorage.getItem("user_uuid");
        if (!uuid) {
          uuid = crypto.randomUUID();
          localStorage.setItem("user_uuid", uuid);
        }
        resolve(uuid);
      }
    });
  }

  // 注入全局样式
  function injectStyles() {
    if (document.getElementById("ai-refund-styles")) return;
    const style = document.createElement("style");
    style.id = "ai-refund-styles";
    style.textContent = `
      .${BUTTON_CLASS} {
        display: inline-block;
        margin-top: 8px;
        padding: 8px 16px;
        background-color: #1a3a6b;
        color: #ffffff;
        font-size: 13px;
        font-weight: 500;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: background-color 0.2s ease, transform 0.1s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        line-height: 1.4;
      }
      .${BUTTON_CLASS}:hover {
        background-color: #274d8f;
      }
      .${BUTTON_CLASS}:active {
        transform: scale(0.96);
      }
      .${BUTTON_CLASS}:disabled {
        background-color: #7a8fa8;
        cursor: not-allowed;
        transform: none;
      }
      .${RESULT_CLASS} {
        margin-top: 10px;
        padding: 12px;
        border: 1px solid #d5d9d9;
        border-radius: 8px;
        background-color: #fafafa;
      }
      .${RESULT_CLASS} textarea {
        width: 100%;
        min-height: 140px;
        padding: 10px;
        font-size: 13px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        border: 1px solid #ccc;
        border-radius: 4px;
        resize: vertical;
        box-sizing: border-box;
        line-height: 1.5;
        color: #333;
        background-color: #fff;
      }
      .${RESULT_CLASS} .copy-btn {
        display: inline-block;
        margin-top: 8px;
        padding: 6px 14px;
        font-size: 12px;
        font-weight: 500;
        color: #1a3a6b;
        background-color: #e8eef7;
        border: 1px solid #1a3a6b;
        border-radius: 5px;
        cursor: pointer;
        transition: background-color 0.2s ease;
      }
      .${RESULT_CLASS} .copy-btn:hover {
        background-color: #d0ddf0;
      }
      .${LIMIT_MSG_CLASS} {
        margin-top: 10px;
        padding: 10px 14px;
        background-color: #fff5f5;
        border: 1px solid #fc8181;
        border-radius: 6px;
        color: #c53030;
        font-size: 13px;
        font-weight: 500;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        line-height: 1.5;
      }
    `;
    document.head.appendChild(style);
  }

  // 为单个 review 节点注入按钮
  function processReviewNode(reviewNode) {
    if (reviewNode.dataset.aiRefundProcessed) return;
    reviewNode.dataset.aiRefundProcessed = "true";

    const btn = document.createElement("button");
    btn.className = BUTTON_CLASS;
    btn.textContent = "✨ AI 生成退款信";
    btn.addEventListener("click", (e) => handleClick(e, btn, reviewNode));

    reviewNode.parentNode.insertBefore(btn, reviewNode.nextSibling);
  }

  // 点击事件处理
  async function handleClick(e, btn, reviewNode) {
    e.preventDefault();
    e.stopPropagation();

    const reviewText = reviewNode.innerText.trim();
    if (!reviewText) {
      alert("未能获取评论内容");
      return;
    }

    // 禁用按钮
    btn.disabled = true;
    btn.textContent = "⏳ 生成中...";

    // 移除之前的结果或提示（如果有）
    const existingResult = btn.nextElementSibling;
    if (existingResult && (existingResult.classList.contains(RESULT_CLASS) || existingResult.classList.contains(LIMIT_MSG_CLASS))) {
      existingResult.remove();
    }

    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_text: reviewText,
          platform: "amazon",
          user_id: userUUID,
        }),
      });

      const json = await response.json();

      // 处理额度超限
      if (json.status === "error" && json.message === "LIMIT_EXCEEDED") {
        renderLimitMessage(btn);
        return;
      }

      if (json.status !== "success" || !json.data) {
        throw new Error(json.message || "后端返回数据异常");
      }

      renderResult(btn, json.data);
    } catch (err) {
      console.error("[AI Refund]", err);
      alert("生成失败: " + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "✨ AI 生成退款信";
    }
  }

  // 渲染额度超限提示
  function renderLimitMessage(btn) {
    const msg = document.createElement("div");
    msg.className = LIMIT_MSG_CLASS;
    msg.textContent = "❌ 您的每日 3 次免费额度已用完！请点击浏览器右上角插件图标订阅解锁无限次生成。";
    btn.parentNode.insertBefore(msg, btn.nextSibling);
  }

  // 渲染结果区域
  function renderResult(btn, emailContent) {
    const container = document.createElement("div");
    container.className = RESULT_CLASS;

    const textarea = document.createElement("textarea");
    textarea.value = emailContent;
    textarea.readOnly = true;

    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.textContent = "📋 一键复制";
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(emailContent).then(() => {
        copyBtn.textContent = "✅ 已复制";
        setTimeout(() => {
          copyBtn.textContent = "📋 一键复制";
        }, 2000);
      }).catch(() => {
        textarea.select();
        document.execCommand("copy");
        copyBtn.textContent = "✅ 已复制";
        setTimeout(() => {
          copyBtn.textContent = "📋 一键复制";
        }, 2000);
      });
    });

    container.appendChild(textarea);
    container.appendChild(copyBtn);
    btn.parentNode.insertBefore(container, btn.nextSibling);
  }

  // 扫描页面中的评论节点
  function scanAndInject() {
    const reviewNodes = document.querySelectorAll(".review-text-content");
    reviewNodes.forEach(processReviewNode);
  }

  // 初始化
  async function init() {
    userUUID = await getOrCreateUUID();
    injectStyles();
    scanAndInject();

    // MutationObserver 监听动态加载的评论
    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldScan = true;
          break;
        }
      }
      if (shouldScan) {
        scanAndInject();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // 确保 DOM 就绪后启动
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
