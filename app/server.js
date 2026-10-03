import express from 'express';
import { GoogleGenAI } from '@google/genai';
import authRouter, { withUser } from './auth.js';

const PORT = process.env.PORT || 3000;
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 프롬프트는 서버에만 둔다. 클라이언트가 임의 프롬프트를 보내면 공개 URL에서 키가 악용된다.
// 아이디어가 정해지면 이 표에 작업을 추가한다.
const TASKS = {
  demo: {
    system: '너는 대학생 서비스의 문서 분석기다. 입력된 텍스트나 이미지를 읽고 한국어로 요약한다.',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '문서 제목 또는 한 줄 요약' },
        points: { type: 'array', items: { type: 'string' }, description: '핵심 내용 3개 이내' },
      },
      required: ['title', 'points'],
    },
  },
};

const ALLOWED_MIME = /^(image\/(png|jpeg|webp|heic)|application\/pdf)$/;
const MAX_FILES = 10;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '15mb' }));
app.use(withUser);                     // ← 추가: 로그인 사용자를 req.user에 실음
app.use('/api/auth', authRouter);      // ← 추가: 회원가입/로그인 라우트
app.use(express.static('public'));

app.get('/api/health', (_req, res) => res.json({ ok: true, model: MODEL }));

app.post('/api/ai/:task', async (req, res) => {
  const task = TASKS[req.params.task];
  if (!task) return res.status(404).json({ error: '알 수 없는 작업이에요.' });

  const { text = '', files = [] } = req.body ?? {};
  if (typeof text !== 'string' || !Array.isArray(files) || files.length > MAX_FILES) {
    return res.status(400).json({ error: '입력 형식이 올바르지 않아요.' });
  }
  if (!text.trim() && files.length === 0) {
    return res.status(400).json({ error: '텍스트나 파일을 하나 이상 넣어 주세요.' });
  }
  for (const f of files) {
    if (!ALLOWED_MIME.test(f?.mimeType) || typeof f?.data !== 'string') {
      return res.status(400).json({ error: '이미지(PNG·JPG·WEBP) 또는 PDF만 올릴 수 있어요.' });
    }
  }

  try {
    const parts = [
      ...files.map((f) => ({ inlineData: { mimeType: f.mimeType, data: f.data } })),
      ...(text.trim() ? [{ text }] : []),
    ];
    const r = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: task.system,
        responseMimeType: 'application/json',
        responseJsonSchema: task.schema,
        httpOptions: { timeout: 60_000 },
      },
    });
    res.json(JSON.parse(r.text));
  } catch (err) {
    console.error(`[ai:${req.params.task}]`, err?.message ?? err);
    res.status(502).json({ error: 'AI 분석에 실패했어요. 잠시 후 다시 시도해 주세요.' });
  }
});

app.listen(PORT, () => console.log(`listening on :${PORT} (model ${MODEL})`));
