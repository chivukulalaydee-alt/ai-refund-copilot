import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.post("/api/generate-email")
async def generate_email(request: Request):
    data = await request.json()

    review_text = data.get("review_text")
    if not review_text:
        return {"status": "error", "message": "missing review_text"}

    platform = data.get("platform", "Amazon")
    user_id = data.get("user_id", "anonymous")

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
        return {"status": "success", "data": reply}

    except Exception as e:
        return {"status": "error", "message": f"AI 生成失败: {str(e)}"}
