import os
import sqlite3
from datetime import date
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

app = Flask(__name__)
CORS(app)

client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com"
)

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "users.db")
DAILY_FREE_LIMIT = 3

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


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS usage (
            user_id TEXT NOT NULL,
            use_date TEXT NOT NULL,
            count INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, use_date)
        )
    """)
    conn.commit()
    conn.close()


def get_usage_count(user_id):
    today = date.today().isoformat()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.execute(
        "SELECT count FROM usage WHERE user_id = ? AND use_date = ?",
        (user_id, today)
    )
    row = cur.fetchone()
    conn.close()
    return row[0] if row else 0


def increment_usage(user_id):
    today = date.today().isoformat()
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        INSERT INTO usage (user_id, use_date, count) VALUES (?, ?, 1)
        ON CONFLICT(user_id, use_date) DO UPDATE SET count = count + 1
    """, (user_id, today))
    conn.commit()
    conn.close()


# 初始化数据库
init_db()


@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok"})


@app.route("/api/generate-email", methods=["POST"])
def generate_email():
    data = request.get_json()
    if not data or "review_text" not in data:
        return jsonify({"status": "error", "message": "missing review_text"}), 400

    review_text = data["review_text"]
    platform = data.get("platform", "Amazon")
    user_id = data.get("user_id", "anonymous")

    # 检查每日免费额度
    current_count = get_usage_count(user_id)
    if current_count >= DAILY_FREE_LIMIT:
        return jsonify({"status": "error", "message": "LIMIT_EXCEEDED"}), 403

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

        # AI 调用成功后才计数
        increment_usage(user_id)

        return jsonify({"status": "success", "data": reply})

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"AI 生成失败: {str(e)}"
        }), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False, threaded=True)
