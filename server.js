const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;
const root = __dirname;
const dataDir = path.join(root, 'data');
const uploadDir = path.join(root, 'uploads');
const cardsFile = path.join(dataDir, 'cards.json');

for (const dir of [dataDir, uploadDir]) fs.mkdirSync(dir, { recursive: true });
if (!fs.existsSync(cardsFile)) fs.writeFileSync(cardsFile, '[]', 'utf8');

app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (_, __, done) => done(null, uploadDir),
  filename: (_, file, done) => {
    const extension = path.extname(file.originalname).toLowerCase();
    done(null, `${Date.now()}-${crypto.randomBytes(5).toString('hex')}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 6 },
  fileFilter: (_, file, done) => {
    const accepted = file.mimetype.startsWith('image/') || file.mimetype.startsWith('audio/');
    done(accepted ? null : new Error('يسمح بملفات الصور والصوت فقط'), accepted);
  }
});

function readCards() {
  try {
    return JSON.parse(fs.readFileSync(cardsFile, 'utf8'));
  } catch {
    return [];
  }
}

function clean(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

app.post('/api/cards', upload.fields([
  { name: 'images', maxCount: 5 },
  { name: 'music', maxCount: 1 }
]), (req, res) => {
  const card = {
    id: crypto.randomBytes(9).toString('base64url'),
    sender: clean(req.body.sender, 100),
    receiver: clean(req.body.receiver, 100),
    title: clean(req.body.title, 150),
    date: clean(req.body.date, 30),
    message: clean(req.body.message, 4000),
    message2: clean(req.body.message2, 4000),
    message3: clean(req.body.message3, 4000),
    theme: ['rose', 'soft', 'blush'].includes(req.body.theme) ? req.body.theme : 'rose',
    images: (req.files?.images || []).map(file => `/uploads/${file.filename}`),
    music: req.files?.music?.[0] ? `/uploads/${req.files.music[0].filename}` : '',
    createdAt: new Date().toISOString()
  };

  if (!card.sender || !card.receiver || !card.message || !card.message2 || !card.message3) {
    return res.status(400).json({ error: 'أكمل الأسماء والرسائل الثلاث قبل إنشاء البطاقة.' });
  }

  const cards = readCards();
  cards.unshift(card);
  fs.writeFileSync(cardsFile, JSON.stringify(cards, null, 2), 'utf8');
  res.json({ ok: true, card, url: `/card/${card.id}` });
});

app.get('/api/cards/:id', (req, res) => {
  const card = readCards().find(item => item.id === req.params.id);
  if (!card) return res.status(404).json({ error: 'البطاقة غير موجودة.' });
  res.json(card);
});

app.use(express.static(path.join(root, 'public')));
app.get('/card/:id', (_, res) => res.sendFile(path.join(root, 'public', 'index.html')));
app.use((error, _, res, __) => res.status(400).json({ error: error.message || 'تعذر رفع الملف.' }));

app.listen(port, () => console.log(`MyCard is ready at http://localhost:${port}`));