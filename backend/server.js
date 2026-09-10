const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Beispiel-Datenstruktur
let items = [
  { id: 1, name: 'Milch', completed: false },
  { id: 2, name: 'Brot', completed: true }
];

// API-Endpunkte
app.get('/api/items', (req, res) => {
  res.json(items);
});

app.post('/api/items', (req, res) => {
  const newItem = {
    id: Date.now(),
    name: req.body.name,
    completed: false
  };
  items.push(newItem);
  res.status(201).json(newItem);
});

app.delete('/api/items/:id', (req, res) => {
  const id = Number(req.params.id);
  items = items.filter(item => item.id !== id);
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Backend läuft auf Port ${PORT}`);
});
