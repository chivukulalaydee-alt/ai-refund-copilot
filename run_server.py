import sys
import asyncio

# 兼容 Windows 事件循环（如后续切换到 FastAPI 可用）
# if sys.platform == "win32":
#     asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from main import app

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=False, threaded=True)
