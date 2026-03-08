import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Saju analysis endpoint with streaming
app.post("/api/analyze", async (req, res) => {
  const { name, gender, calendarType, birthYear, birthMonth, birthDay, birthTime } = req.body;

  if (!birthYear || !birthMonth || !birthDay) {
    return res.status(400).json({ error: "생년월일을 입력해주세요." });
  }

  const genderText = gender === "male" ? "남성" : "여성";
  const calendarText = calendarType === "solar" ? "양력" : "음력";
  const nameText = name ? `이름: ${name}` : "이름: 미입력";
  const birthTimeText = birthTime === "unknown" ? "모름" : birthTime;

  const prompt = `당신은 사주명리학 전문가입니다. 다음 정보를 바탕으로 사주를 분석해주세요.

=== 사주 정보 ===
${nameText}
성별: ${genderText}
달력 유형: ${calendarText}
생년월일: ${birthYear}년 ${birthMonth}월 ${birthDay}일
출생 시간: ${birthTimeText}

다음 항목들을 상세히 분석해주세요:

1. **사주팔자 (四柱八字)**
   - 년주(年柱), 월주(月柱), 일주(日柱), 시주(時柱) 분석
   - 천간(天干)과 지지(地支) 설명

2. **오행 분석 (五行分析)**
   - 목(木), 화(火), 토(土), 금(金), 수(水)의 균형
   - 강한 오행과 부족한 오행

3. **일간 분석**
   - 일간의 특성과 성격
   - 강약 분석

4. **성격 및 특성**
   - 주요 성격 특징
   - 장점과 단점
   - 대인관계 스타일

5. **운세 분석**
   - 올해(2026년) 운세
   - 건강운, 재물운, 애정운, 직업운

6. **조언 및 개운법**
   - 행운의 방향, 색상, 숫자
   - 생활 속 개운 방법

분석은 따뜻하고 격려적인 톤으로 작성하되, 구체적이고 실용적인 정보를 제공해주세요. 마크다운 형식으로 작성해주세요.`;

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const stream = client.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        const data = JSON.stringify({ text: event.delta.text });
        res.write(`data: ${data}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (error) {
    console.error("API Error:", error);
    const errMsg =
      error instanceof Anthropic.AuthenticationError
        ? "API 키가 유효하지 않습니다."
        : error instanceof Anthropic.RateLimitError
          ? "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
          : "분석 중 오류가 발생했습니다.";
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
  } finally {
    res.end();
  }
});

// 로컬 실행 시에만 서버 시작 (Vercel 환경에서는 export default로 처리)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`사주 분석 서버가 http://localhost:${PORT} 에서 실행중입니다.`);
  });
}

export default app;
