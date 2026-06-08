import os
import json
from http.server import BaseHTTPRequestHandler
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com"
)

SYSTEM_PROMPT = """你是一位精通跨境电商（Amazon/Shopify）危机公关与挽留客户的高级话术专家。
你的任务是根据买家差评的具体内容，生成针对性极强的英文退款/补偿邮件。

输出格式必须严格如下：

【方案一：全额退款挽留信 (Full Refund)】
语气极其真诚，直接承诺全额退款，无需退货，恳请对方协助修改或删除差评。必须针对差评中提到的具体问题逐一致歉。

【方案二：免费补发并赠送小礼物 (Replacement & Gift)】
真诚致歉，说明是偶发质量缺陷，愿意免费补发全新商品并附赠额外小礼品作为补偿。必须针对差评中提到的具体问题给出解决承诺。

注意：
- 必须用英文撰写邮件正文
- 必须针对差评中提到的每一个具体问题点进行回应
- 语气要真诚、专业、有温度
- 邮件开头要有称呼，结尾要有署名"""


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            self._respond(400, {"status": "error", "message": "invalid JSON"})
            return

        review_text = data.get("review_text")
        if not review_text:
            self._respond(400, {"status": "error", "message": "missing review_text"})
            return

        platform = data.get("platform", "Amazon")

        try:
            response = client.chat.completions.create(
                model="deepseek-v4-flash",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"平台: {platform}\n买家差评内容: {review_text}\n\n请根据以上差评生成两套退款/补偿邮件方案。"}
                ],
                temperature=0.7,
                max_tokens=2000
            )
            reply = response.choices[0].message.content
            self._respond(200, {"status": "success", "data": reply})

        except Exception as e:
            self._respond(500, {"status": "error", "message": f"AI 生成失败: {str(e)}"})

    def _respond(self, status_code, data):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))
