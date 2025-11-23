const express = require('express');
const multer = require('multer');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' });
const app = express();

app.post('/api/convert', upload.single('file'), (req, res) => {
  const inPath = req.file.path;
  const outName = `clip_${Date.now()}.mp4`;
  const outPath = path.join(__dirname, 'public', outName);
  if (!fs.existsSync(path.join(__dirname, 'public'))) fs.mkdirSync(path.join(__dirname, 'public'));

  execFile('ffmpeg', ['-y', '-i', inPath, '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-c:a', 'aac', '-b:a', '128k', outPath], (err) => {
    fs.unlink(inPath, () => {});
    if (err) {
      console.error('ffmpeg error', err);
      return res.status(500).json({ error: 'conversion failed', detail: err.message });
    }
    res.json({ url: `${req.protocol}://${req.get('host')}/${outName}` });
  });
});

app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server listening on', PORT));
