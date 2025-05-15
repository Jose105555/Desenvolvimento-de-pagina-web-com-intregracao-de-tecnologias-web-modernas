/* Importa o módulo Express para criar o roteador */
const express = require('express');
/* Importa o módulo JSON Web Token para autenticação */
const jwt = require('jsonwebtoken');
/* Importa o módulo File System para leitura e escrita de arquivos */
const fs = require('fs');
/* Importa o módulo Path para manipulação de caminhos de arquivos */
const path = require('path');
/* Cria uma instância do roteador Express */
const router = express.Router();

/* Define a chave secreta para assinar e verificar tokens JWT */
const JWT_SECRET = 'your_jwt_secret';
/* Define o caminho para o arquivo de banco de dados JSON */
const DB_FILE = path.join(__dirname, 'database.json');

/* Middleware de autenticação para verificar tokens JWT */
const authenticate = (req, res, next) => {
  /* Extrai o token do cabeçalho Authorization (formato: Bearer <token>) */
  const token = req.headers.authorization?.split(' ')[1];
  /* Verifica se o token foi fornecido */
  if (!token) return res.status(401).json({ success: false, message: 'Token não fornecido' });
  try {
    /* Verifica o token JWT e armazena os dados do usuário na requisição */
    req.user = jwt.verify(token, JWT_SECRET);
    /* Prossegue para o próximo middleware ou rota */
    next();
  } catch (e) {
    /* Retorna erro se o token for inválido */
    res.status(401).json({ success: false, message: 'Token inválido' });
  }
};

/* Rota para login de usuários */
router.post('/login', (req, res) => {
  /* Extrai os dados do corpo da requisição */
  const { name, password, role } = req.body;
  /* Validações básicas no lado do servidor */
  if (!name) return res.status(400).json({ success: false, message: 'O campo Nome é obrigatório' });
  if (!password) return res.status(400).json({ success: false, message: 'O campo Senha é obrigatório' });
  if (!role) return res.status(400).json({ success: false, message: 'O campo Função é obrigatório' });

  try {
    /* Lê o banco de dados JSON */
    const db = JSON.parse(fs.readFileSync(DB_FILE));
    /* Procura um usuário com nome, senha e função correspondentes */
    const user = db.users.find(u => u.name === name && u.password === password && u.role === role);
    /* Retorna erro se o usuário não for encontrado */
    if (!user) return res.status(401).json({ success: false, message: 'Credenciais ou função inválidas' });
    /* Gera um token JWT com ID, nome e função do usuário, válido por 1 hora */
    const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    /* Retorna o token e os dados do usuário */
    res.json({ success: true, token, user: { id: user.id, name: user.name, role: user.role } });
  } catch (e) {
    /* Loga e retorna erro se houver falha na leitura do banco de dados */
    console.error('Erro ao ler banco de dados:', e.message);
    res.status(500).json({ success: false, message: 'Erro ao processar login' });
  }
});

/* Rota para registro de novos usuários */
router.post('/register', (req, res) => {
  /* Extrai os dados do corpo da requisição */
  const { name, email, password, date, specialDate, role } = req.body;
  /* Validações básicas no lado do servidor */
  if (!name) return res.status(400).json({ success: false, message: 'O campo Nome é obrigatório' });
  if (!email) return res.status(400).json({ success: false, message: 'O campo Email é obrigatório' });
  if (!email.includes('@')) return res.status(400).json({ success: false, message: 'Email inválido' });
  if (!password) return res.status(400).json({ success: false, message: 'O campo Senha é obrigatório' });
  if (!date) return res.status(400).json({ success: false, message: 'O campo Data de Nascimento é obrigatório' });
  if (!specialDate) return res.status(400).json({ success: false, message: 'O campo Data Especial é obrigatório' });
  if (!role) return res.status(400).json({ success: false, message: 'O campo Função é obrigatório' });

  try {
    /* Lê o banco de dados JSON */
    const db = JSON.parse(fs.readFileSync(DB_FILE));
    /* Verifica se o nome já está registrado */
    if (db.users.find(u => u.name === name)) {
      return res.status(400).json({ success: false, message: 'Nome já registrado' });
    }
    /* Verifica se o email já está registrado */
    if (db.users.find(u => u.email === email)) {
      return res.status(400).json({ success: false, message: 'Email já registrado' });
    }
    /* Gera um novo ID baseado no tamanho da lista de usuários */
    const id = (db.users.length + 1).toString();
    /* Adiciona o novo usuário ao banco de dados */
    db.users.push({ id, name, email, password, date, specialDate, role });
    /* Salva as alterações no banco de dados */
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    /* Retorna mensagem de sucesso */
    res.json({ success: true, message: 'Usuário registrado com sucesso' });
  } catch (e) {
    /* Loga e retorna erro se houver falha na escrita do banco de dados */
    console.error('Erro ao escrever no banco de dados:', e.message);
    res.status(500).json({ success: false, message: 'Erro ao processar registro' });
  }
});

/* Rota para adicionar usuário (apenas administradores) */
router.post('/users', authenticate, (req, res) => {
  /* Verifica se o usuário é administrador */
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Acesso negado' });
  }
  /* Extrai os dados do corpo da requisição */
  const { name, email, password, date, specialDate, role } = req.body;
  /* Validações básicas no lado do servidor */
  if (!name) return res.status(400).json({ success: false, message: 'O campo Nome é obrigatório' });
  if (!email) return res.status(400).json({ success: false, message: 'O campo Email é obrigatório' });
  if (!email.includes('@')) return res.status(400).json({ success: false, message: 'Email inválido' });
  if (!password) return res.status(400).json({ success: false, message: 'O campo Senha é obrigatório' });
  if (password.length < 6) return res.status(400).json({ success: false, message: 'A senha deve ter pelo menos 6 caracteres' });
  if (!date) return res.status(400).json({ success: false, message: 'O campo Data de Nascimento é obrigatório' });
  if (!specialDate) return res.status(400).json({ success: false, message: 'O campo Data Especial é obrigatório' });
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ success: false, message: 'Função inválida' });

  try {
    /* Lê o banco de dados JSON */
    const db = JSON.parse(fs.readFileSync(DB_FILE));
    /* Verifica se o nome já está registrado */
    if (db.users.find(u => u.name === name)) {
      return res.status(400).json({ success: false, message: 'Nome já registrado' });
    }
    /* Verifica se o email já está registrado */
    if (db.users.find(u => u.email === email)) {
      return res.status(400).json({ success: false, message: 'Email já registrado' });
    }
    /* Gera um novo ID baseado no tamanho da lista de usuários */
    const id = (db.users.length + 1).toString();
    /* Adiciona o novo usuário ao banco de dados */
    db.users.push({ id, name, email, password, date, specialDate, role });
    /* Salva as alterações no banco de dados */
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    /* Retorna mensagem de sucesso */
    res.json({ success: true, message: 'Usuário adicionado com sucesso' });
  } catch (e) {
    /* Loga e retorna erro se houver falha na escrita do banco de dados */
    console.error('Erro ao escrever no banco de dados:', e.message);
    res.status(500).json({ success: false, message: 'Erro ao adicionar usuário' });
  }
});

/* Rota para recuperação de senha (simulada) */
router.post('/forgot-password', (req, res) => {
  /* Extrai o email do corpo da requisição */
  const { email } = req.body;
  /* Valida o campo email */
  if (!email) return res.status(400).json({ success: false, message: 'Email é obrigatório' });
  try {
    /* Lê o banco de dados JSON */
    const db = JSON.parse(fs.readFileSync(DB_FILE));
    /* Verifica se o email está registrado */
    if (!db.users.find(u => u.email === email)) {
      return res.status(404).json({ success: false, message: 'Email não encontrado' });
    }
    /* Retorna mensagem simulando o envio de um link de recuperação */
    res.json({ success: true, message: 'Link de recuperação enviado (simulado)' });
  } catch (e) {
    /* Loga e retorna erro se houver falha na leitura do banco de dados */
    console.error('Erro ao processar recuperação:', e.message);
    res.status(500).json({ success: false, message: 'Erro ao processar recuperação' });
  }
});

/* Rota para listar contatos */
router.get('/contacts', authenticate, (req, res) => {
  try {
    /* Lê o banco de dados JSON */
    const db = JSON.parse(fs.readFileSync(DB_FILE));
    /* Filtra os contatos pertencentes ao usuário ou todos se for administrador */
    const contacts = db.contacts.filter(c => c.userId === req.user.id || req.user.role === 'admin');
    /* Retorna a lista de contatos */
    res.json(contacts);
  } catch (e) {
    /* Retorna erro se houver falha na leitura do banco de dados */
    res.status(500).json({ success: false, message: 'Erro ao carregar contatos' });
  }
});

/* Rota para adicionar um novo contato */
router.post('/contacts', authenticate, (req, res) => {
  /* Extrai os dados do corpo da requisição */
  const { name, phone, email, category, specialDate } = req.body;
  /* Validações básicas no lado do servidor */
  if (!name) return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
  if (!phone) return res.status(400).json({ success: false, message: 'Telefone é obrigatório' });
  if (!category) return res.status(400).json({ success: false, message: 'Categoria é obrigatória' });
  if (!phone.startsWith('+258') || phone.replace('+258', '').length !== 9) {
    return res.status(400).json({ success: false, message: 'Telefone deve começar com +258 e ter 9 dígitos' });
  }
  try {
    /* Lê o banco de dados JSON */
    const db = JSON.parse(fs.readFileSync(DB_FILE));
    /* Gera um novo ID baseado no tamanho da lista de contatos */
    const id = (db.contacts.length + 1).toString();
    /* Cria o objeto de contato com os dados fornecidos */
    const contact = {
      id,
      userId: req.user.id,
      name,
      phone,
      email: email || '',
      category,
      specialDate: specialDate || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    /* Adiciona o contato ao banco de dados */
    db.contacts.push(contact);
    /* Salva as alterações no banco de dados */
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    /* Retorna o contato adicionado */
    res.json({ success: true, contact });
  } catch (e) {
    /* Retorna erro se houver falha na escrita do banco de dados */
    res.status(500).json({ success: false, message: 'Erro ao adicionar contato' });
  }
});

/* Rota para atualizar um contato existente */
router.put('/contacts/:id', authenticate, (req, res) => {
  /* Extrai o ID do contato dos parâmetros da URL */
  const { id } = req.params;
  /* Extrai os dados do corpo da requisição */
  const { name, phone, email, category, specialDate } = req.body;
  /* Validações básicas no lado do servidor */
  if (!name) return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
  if (!phone) return res.status(400).json({ success: false, message: 'Telefone é obrigatório' });
  if (!category) return res.status(400).json({ success: false, message: 'Categoria é obrigatória' });
  if (!phone.startsWith('+258') || phone.replace('+258', '').length !== 9) {
    return res.status(400).json({ success: false, message: 'Telefone deve começar com +258 e ter 9 dígitos' });
  }
  try {
    /* Lê o banco de dados JSON */
    const db = JSON.parse(fs.readFileSync(DB_FILE));
    /* Procura o contato pelo ID, verificando se pertence ao usuário ou se é administrador */
    const contact = db.contacts.find(c => c.id === id && (c.userId === req.user.id || req.user.role === 'admin'));
    /* Retorna erro se o contato não for encontrado */
    if (!contact) return res.status(404).json({ success: false, message: 'Contato não encontrado' });
    /* Atualiza os dados do contato */
    contact.name = name;
    contact.phone = phone;
    contact.email = email || '';
    contact.category = category;
    contact.specialDate = specialDate || '';
    contact.updatedAt = new Date().toISOString();
    /* Salva as alterações no banco de dados */
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    /* Retorna o contato atualizado */
    res.json({ success: true, contact });
  } catch (e) {
    /* Retorna erro se houver falha na escrita do banco de dados */
    res.status(500).json({ success: false, message: 'Erro ao atualizar contato' });
  }
});

/* Rota para excluir um contato */
router.delete('/contacts/:id', authenticate, (req, res) => {
  /* Extrai o ID do contato dos parâmetros da URL */
  const { id } = req.params;
  try {
    /* Lê o banco de dados JSON */
    const db = JSON.parse(fs.readFileSync(DB_FILE));
    /* Procura o índice do contato pelo ID, verificando se pertence ao usuário ou se é administrador */
    const index = db.contacts.findIndex(c => c.id === id && (c.userId === req.user.id || req.user.role === 'admin'));
    /* Retorna erro se o contato não for encontrado */
    if (index === -1) return res.status(404).json({ success: false, message: 'Contato não encontrado' });
    /* Remove o contato do banco de dados */
    db.contacts.splice(index, 1);
    /* Salva as alterações no banco de dados */
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    /* Retorna mensagem de sucesso */
    res.json({ success: true, message: 'Contato excluído' });
  } catch (e) {
    /* Retorna erro se houver falha na escrita do banco de dados */
    res.status(500).json({ success: false, message: 'Erro ao excluir contato' });
  }
});

/* Rota para obter um contato específico */
router.get('/contacts/:id', authenticate, (req, res) => {
  /* Extrai o ID do contato dos parâmetros da URL */
  const { id } = req.params;
  try {
    /* Lê o banco de dados JSON */
    const db = JSON.parse(fs.readFileSync(DB_FILE));
    /* Procura o contato pelo ID, verificando se pertence ao usuário ou se é administrador */
    const contact = db.contacts.find(c => c.id === id && (c.userId === req.user.id || req.user.role === 'admin'));
    /* Retorna erro se o contato não for encontrado */
    if (!contact) return res.status(404).json({ success: false, message: 'Contato não encontrado' });
    /* Retorna o contato */
    res.json(contact);
  } catch (e) {
    /* Retorna erro se houver falha na leitura do banco de dados */
    res.status(500).json({ success: false, message: 'Erro ao carregar contato' });
  }
});

/* Rota para listar todos os usuários (apenas administradores) */
router.get('/users', authenticate, (req, res) => {
  /* Verifica se o usuário é administrador */
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Acesso negado' });
  }
  try {
    /* Lê o banco de dados JSON */
    const db = JSON.parse(fs.readFileSync(DB_FILE));
    /* Retorna a lista de usuários */
    res.json(db.users);
  } catch (e) {
    /* Retorna erro se houver falha na leitura do banco de dados */
    res.status(500).json({ success: false, message: 'Erro ao carregar usuários' });
  }
});

/* Rota para excluir um usuário (apenas administradores) */
router.delete('/users/:id', authenticate, (req, res) => {
  /* Verifica se o usuário é administrador */
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Acesso negado' });
  }
  /* Extrai o ID do usuário dos parâmetros da URL */
  const { id } = req.params;
  try {
    /* Lê o banco de dados JSON */
    const db = JSON.parse(fs.readFileSync(DB_FILE));
    /* Procura o índice do usuário pelo ID */
    const index = db.users.findIndex(u => u.id === id);
    /* Retorna erro se o usuário não for encontrado */
    if (index === -1) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    /* Verifica se o usuário está tentando excluir a própria conta */
    if (db.users[index].id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Não pode excluir a própria conta' });
    }
    /* Remove o usuário do banco de dados */
    db.users.splice(index, 1);
    /* Salva as alterações no banco de dados */
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    /* Retorna mensagem de sucesso */
    res.json({ success: true, message: 'Usuário excluído' });
  } catch (e) {
    /* Retorna erro se houver falha na escrita do banco de dados */
    res.status(500).json({ success: false, message: 'Erro ao excluir usuário' });
  }
});

/* Rota para atualizar a função de um usuário (apenas administradores) */
router.put('/users/:id/role', authenticate, (req, res) => {
  /* Verifica se o usuário é administrador */
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Acesso negado' });
  }
  /* Extrai o ID do usuário dos parâmetros da URL */
  const { id } = req.params;
  /* Extrai a nova função do corpo da requisição */
  const { role } = req.body;
  /* Valida a função fornecida */
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Função inválida' });
  }
  try {
    /* Lê o banco de dados JSON */
    const db = JSON.parse(fs.readFileSync(DB_FILE));
    /* Procura o usuário pelo ID */
    const user = db.users.find(u => u.id === id);
    /* Retorna erro se o usuário não for encontrado */
    if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    /* Verifica se o usuário está tentando alterar a própria função */
    if (user.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Não pode alterar a própria função' });
    }
    /* Atualiza a função do usuário */
    user.role = role;
    /* Salva as alterações no banco de dados */
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    /* Retorna mensagem de sucesso */
    res.json({ success: true, message: 'Função atualizada' });
  } catch (e) {
    /* Retorna erro se houver falha na escrita do banco de dados */
    res.status(500).json({ success: false, message: 'Erro ao atualizar função' });
  }
});

/* Rota para gerar relatórios (apenas administradores) */
router.get('/reports', authenticate, (req, res) => {
  /* Verifica se o usuário é administrador */
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Acesso negado' });
  }
  try {
    /* Lê o banco de dados JSON */
    const db = JSON.parse(fs.readFileSync(DB_FILE));
    /* Calcula a data de um mês atrás para relatórios de atividade recente */
    const now = new Date();
    const oneMonthAgo = new Date(now.setMonth(now.getMonth() - 1));

    /* Relatório: Contatos por categoria */
    const categoryReport = db.contacts.reduce((acc, c) => {
      /* Incrementa a contagem para cada categoria, inicializando com 0 se não existir */
      acc[c.category] = (acc[c.category] || 0) + 1;
      return acc;
    }, { Família: 0, Trabalho: 0, Amigos: 0, Clientes: 0 });

    /* Relatório: Contatos ativos vs inativos (baseado em interações no último mês) */
    const activeReport = {
      active: db.interactions.filter(i => new Date(i.timestamp) > oneMonthAgo).length,
      inactive: db.contacts.length - db.interactions.filter(i => new Date(i.timestamp) > oneMonthAgo).length
    };

    /* Relatório: Atualizações recentes (contatos atualizados no último mês) */
    const updatesReport = db.contacts
      .filter(c => new Date(c.updatedAt) > oneMonthAgo)
      .map(c => ({ name: c.name, updatedAt: c.updatedAt }))
      .slice(0, 10); /* Limita a 10 registros */

    /* Relatório: Datas especiais dos contatos */
    const specialDatesReport = db.contacts
      .filter(c => c.specialDate)
      .map(c => ({ name: c.name, specialDate: c.specialDate }))
      .slice(0, 10); /* Limita a 10 registros */

    /* Relatório: Frequência de interação por contato */
    const interactionReport = db.interactions.reduce((acc, i) => {
      /* Procura o contato associado à interação */
      const contact = db.contacts.find(c => c.id === i.contactId);
      /* Incrementa a contagem de interações para o contato */
      if (contact) acc[contact.name] = (acc[contact.name] || 0) + 1;
      return acc;
    }, {});
    const interactionList = Object.entries(interactionReport)
      .map(([name, count]) => ({ name, count }))
      .slice(0, 10); /* Limita a 10 registros */

    /* Relatório: Crescimento da base de contatos por mês */
    const growthReport = db.contacts.reduce((acc, c) => {
      /* Formata a data de criação como mês e ano */
      const month = new Date(c.createdAt).toLocaleString('pt', { month: 'long', year: 'numeric' });
      /* Incrementa a contagem para o mês */
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});
    const growthList = Object.entries(growthReport)
      .map(([month, count]) => ({ month, count }))
      .slice(0, 12); /* Limita a 12 registros */

    /* Relatório: Falhas de contato (contatos com email ou telefone ausentes/inválidos) */
    const failuresReport = db.contacts
      .filter(c => !c.email || !c.phone || (c.email && !c.email.includes('@')))
      .map(c => ({ name: c.name, issue: !c.email ? 'Email ausente' : !c.phone ? 'Telefone ausente' : 'Email inválido' }))
      .slice(0, 10); /* Limita a 10 registros */

    /* Retorna todos os relatórios em um objeto JSON */
    res.json({
      category: categoryReport,
      active: activeReport,
      updates: updatesReport,
      specialDates: specialDatesReport,
      interactions: interactionList,
      growth: growthList,
      failures: failuresReport
    });
  } catch (e) {
    /* Retorna erro se houver falha na leitura do banco de dados */
    res.status(500).json({ success: false, message: 'Erro ao gerar relatórios' });
  }
});

/* Exporta o roteador para uso em app.js */
module.exports = router;