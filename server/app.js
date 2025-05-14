const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const WebSocket = require('ws');
const routes = require('./routes');
const initDB = require('./initDB');

const app = express();
const port = 3000;

// Configurar banco de dados SQLite
const db = new sqlite3.Database('agenda.db', (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite');
    initDB(db);
  }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public'), (req, res, next) => {
  console.log(`Servindo arquivo estático: ${req.url}`);
  next();
}));
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Rotas
app.use('/api', routes);

// Servidor WebSocket
const server = app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Novo cliente WebSocket conectado');
  ws.on('message', (message) => {
    console.log('Mensagem recebida:', message.toString());
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message.toString());
      }
    });
  });
  ws.on('close', () => {
    console.log('Cliente WebSocket desconectado');
  });
});

// Tratamento de erros
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) console.error('Erro ao fechar o banco de dados:', err.message);
    console.log('Banco de dados fechado');
    process.exit(0);
  });
});