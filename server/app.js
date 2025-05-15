/* Importa o módulo Express para criar o servidor web */
const express = require('express');
/* Importa o módulo HTTP nativo do Node.js para criar o servidor */
const http = require('http');
/* Importa o módulo WebSocket para gerenciar conexões em tempo real */
const WebSocket = require('ws');
/* Importa o módulo JSON Web Token para autenticação */
const jwt = require('jsonwebtoken');
/* Importa o módulo Path para manipulação de caminhos de arquivos */
const path = require('path');
/* Importa o módulo de rotas definido em routes.js */
const routes = require('./routes');

/* Cria uma instância do aplicativo Express */
const app = express();
/* Cria um servidor HTTP baseado no aplicativo Express */
const server = http.createServer(app);
/* Cria um servidor WebSocket associado ao servidor HTTP */
const wss = new WebSocket.Server({ server });

/* Define a chave secreta para assinar e verificar tokens JWT */
const JWT_SECRET = 'your_jwt_secret';
/* Mapa para armazenar clientes WebSocket conectados, usando o ID do usuário como chave */
const clients = new Map();
/* Mapa para rastrear o número de mensagens respondidas pelo bot por usuário */
const messageCounts = new Map();

/* Objeto com respostas predefinidas do bot para palavras-chave */
const botResponses = {
  'oi': 'Olá! Como posso ajudar você hoje?', /* Resposta para mensagens contendo "oi" */
  'ajuda': 'Claro! Você pode gerenciar contatos, acessar relatórios (se for admin) ou conversar aqui. O que precisa?', /* Resposta para "ajuda" */
  'contato': 'Para gerenciar contatos, volte à página principal e use a seção "Seus Contatos". Quer ajuda com algo específico?', /* Resposta para "contato" */
  'admin': 'Se precisar de um administrador, continue enviando mensagens. Após 5 respostas automáticas, um admin será notificado!', /* Resposta para "admin" */
  'relatório': 'Relatórios estão disponíveis para administradores na seção "Relatórios" da agenda. Quer saber mais?', /* Resposta para "relatório" */
  'default': 'Desculpe, não entendi. Tente palavras como "ajuda", "contato" ou "admin".' /* Resposta padrão para mensagens não reconhecidas */
};

/* Função para obter a resposta do bot com base na mensagem recebida */
function getBotResponse(message) {
  /* Converte a mensagem para minúsculas para comparação insensível a maiúsculas */
  const lowerMessage = message.toLowerCase();
  /* Itera sobre as respostas do bot, exceto a padrão */
  for (const [key, response] of Object.entries(botResponses)) {
    /* Verifica se a chave (exceto 'default') está presente na mensagem */
    if (key !== 'default' && lowerMessage.includes(key)) {
      /* Retorna a resposta correspondente */
      return response;
    }
  }
  /* Retorna a resposta padrão se nenhuma chave for encontrada */
  return botResponses.default;
}

/* Evento disparado quando um novo cliente se conecta ao WebSocket */
wss.on('connection', (ws) => {
  /* Evento disparado quando uma mensagem é recebida do cliente */
  ws.on('message', (data) => {
    /* Declara a variável para armazenar a mensagem parseada */
    let msg;
    try {
      /* Converte os dados recebidos (string JSON) em objeto */
      msg = JSON.parse(data);
    } catch (e) {
      /* Envia uma mensagem de erro se o JSON for inválido */
      ws.send(JSON.stringify({ sender: 'Sistema', message: 'Mensagem inválida', timestamp: new Date().toISOString() }));
      return;
    }

    /* Verifica se a mensagem é do tipo autenticação */
    if (msg.type === 'auth') {
      try {
        /* Verifica o token JWT usando a chave secreta */
        const decoded = jwt.verify(msg.token, JWT_SECRET);
        /* Armazena os dados do usuário no objeto WebSocket */
        ws.user = decoded;
        /* Registra o cliente no mapa de clientes usando o ID do usuário */
        clients.set(decoded.id, ws);
        /* Envia uma mensagem de boas-vindas ao cliente */
        ws.send(JSON.stringify({ sender: 'Sistema', message: `Bem-vindo, ${decoded.name}!`, timestamp: new Date().toISOString(), isBot: true }));
      } catch (e) {
        /* Envia uma mensagem de erro e fecha a conexão se a autenticação falhar */
        ws.send(JSON.stringify({ sender: 'Sistema', message: 'Autenticação falhou', timestamp: new Date().toISOString() }));
        ws.close();
      }
    } else if (msg.type === 'message' && ws.user) { /* Verifica se a mensagem é do tipo mensagem e o usuário está autenticado */
      /* Obtém a contagem de mensagens do usuário ou inicializa como 0 */
      const count = messageCounts.get(ws.user.id) || 0;
      /* Verifica se o limite de 5 respostas automáticas foi atingido */
      const needsAdmin = count >= 5;

      /* Caso o limite não tenha sido atingido e a mensagem não seja para um destinatário específico */
      if (!needsAdmin && !msg.recipientId) {
        /* Obtém a resposta do bot para a mensagem */
        const botResponse = getBotResponse(msg.message);
        /* Incrementa a contagem de mensagens do usuário */
        messageCounts.set(ws.user.id, count + 1);
        /* Cria o objeto da mensagem do bot */
        const botMsg = {
          sender: 'Bot',
          message: botResponse,
          timestamp: new Date().toISOString(),
          isBot: true,
          fromUserId: ws.user.id
        };
        /* Envia a resposta do bot ao cliente */
        ws.send(JSON.stringify(botMsg));

        /* Verifica se o limite de 5 respostas foi atingido */
        if (count + 1 === 5) {
          /* Envia uma notificação de limite atingido ao cliente */
          ws.send(JSON.stringify({
            type: 'limitReached',
            sender: 'Sistema',
            message: 'Limite de 5 respostas automáticas atingido',
            timestamp: new Date().toISOString(),
            fromUserId: ws.user.id
          }));

          /* Notifica todos os administradores conectados */
          clients.forEach((client, clientId) => {
            if (client.user && client.user.role === 'admin') {
              client.send(JSON.stringify({
                sender: 'Sistema',
                message: `O usuário ${ws.user.name} atingiu o limite de 5 respostas. Responda diretamente.`,
                timestamp: new Date().toISOString(),
                fromUserId: ws.user.id,
                needsAdmin: true
              }));
            }
          });
        }
      } else if (needsAdmin && !msg.recipientId) { /* Caso o limite tenha sido atingido e não haja destinatário específico */
        /* Encaminha a mensagem do usuário para todos os administradores */
        clients.forEach((client, clientId) => {
          if (client.user && client.user.role === 'admin') {
            client.send(JSON.stringify({
              sender: ws.user.name,
              message: msg.message,
              timestamp: new Date().toISOString(),
              fromUserId: ws.user.id,
              needsAdmin: true
            }));
          }
        });
      } else if (msg.recipientId && ws.user.role === 'admin') { /* Caso a mensagem seja de um administrador para um usuário específico */
        /* Obtém o WebSocket do destinatário */
        const recipientWs = clients.get(msg.recipientId);
        if (recipientWs) {
          /* Envia a mensagem do administrador ao destinatário */
          recipientWs.send(JSON.stringify({
            sender: ws.user.name,
            message: msg.message,
            timestamp: new Date().toISOString(),
            fromUserId: ws.user.id
          }));
          /* Envia uma cópia da mensagem ao administrador (para exibir no próprio chat) */
          ws.send(JSON.stringify({
            sender: ws.user.name,
            message: msg.message,
            timestamp: new Date().toISOString(),
            fromUserId: msg.recipientId
          }));
        } else {
          /* Notifica o administrador se o destinatário não estiver online */
          ws.send(JSON.stringify({
            sender: 'Sistema',
            message: 'Usuário não está online',
            timestamp: new Date().toISOString()
          }));
        }
      } else { /* Caso a mensagem seja geral ou para um destinatário específico (não administradores) */
        /* Envia a mensagem para todos os clientes conectados, exceto o remetente */
        clients.forEach((client, clientId) => {
          if (client !== ws && (!msg.recipientId || clientId === msg.recipientId)) {
            client.send(JSON.stringify({
              sender: ws.user.name,
              message: msg.message,
              timestamp: new Date().toISOString(),
              fromUserId: ws.user.id
            }));
          }
        });
      }
    }
  });

  /* Evento disparado quando a conexão WebSocket é fechada */
  ws.on('close', () => {
    /* Remove o cliente do mapa de clientes, se estiver autenticado */
    if (ws.user) {
      clients.delete(ws.user.id);
    }
  });
});

/* Middleware para parsear corpos de requisições JSON */
app.use(express.json());
/* Middleware para servir arquivos estáticos da pasta public */
app.use(express.static(path.join(__dirname, '../public')));
/* Middleware para usar as rotas definidas em routes.js sob o prefixo /api */
app.use('/api', routes);

/* Define a porta do servidor, usando a variável de ambiente PORT ou 3000 como padrão */
const PORT = process.env.PORT || 3000;
/* Inicia o servidor na porta especificada */
server.listen(PORT, () => {
  /* Exibe uma mensagem no console quando o servidor está rodando */
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});