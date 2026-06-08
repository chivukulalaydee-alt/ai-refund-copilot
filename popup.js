(function () {
  "use strict";

  const DEFAULT_API_URL = "http://localhost:8000";
  const STORAGE_KEY = "ai_refund_api_url";

  const apiUrlInput = document.getElementById("apiUrl");
  const saveBtn = document.getElementById("saveBtn");
  const statusTag = document.getElementById("statusTag");
  const toast = document.getElementById("toast");

  // 初始化：从 storage 读取已保存的 URL
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const savedUrl = result[STORAGE_KEY] || DEFAULT_API_URL;
    apiUrlInput.value = savedUrl;
    checkConnection(savedUrl);
  });

  // 保存按钮点击
  saveBtn.addEventListener("click", () => {
    const url = apiUrlInput.value.trim() || DEFAULT_API_URL;
    chrome.storage.local.set({ [STORAGE_KEY]: url }, () => {
      showToast();
      checkConnection(url);
    });
  });

  // 检测后端连接状态
  async function checkConnection(baseUrl) {
    try {
      const resp = await fetch(baseUrl + "/api/health", {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      });
      if (resp.ok) {
        setStatus(true);
      } else {
        setStatus(false);
      }
    } catch {
      setStatus(false);
    }
  }

  // 更新状态标签
  function setStatus(connected) {
    if (connected) {
      statusTag.textContent = "服务已连接";
      statusTag.className = "status-tag connected";
    } else {
      statusTag.textContent = "未连接";
      statusTag.className = "status-tag disconnected";
    }
  }

  // Toast 提示
  function showToast() {
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 1800);
  }
})();
