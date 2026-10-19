const express = require('express');
const path = require('path');

const app = express();
const root = path.join(__dirname, 'public');

app.disable('x-powered-by');

app.use(express.static(root));

app.get('*', (_req, res) => {
  res.sendFile(path.join(root, 'index.html'));
});

app.listen(8080, '0.0.0.0', () => {
  console.log('Frontend escuchando en 8080');
});