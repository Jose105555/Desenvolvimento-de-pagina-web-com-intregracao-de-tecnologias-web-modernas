const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

// Middleware para verificar autenticação
function ensureAuthenticated(req, res, next) {
  const username = req.headers['x-username'];
  if (!username) {
    console.warn('Autenticação falhou: x-username ausente');
    return res.status(401).json({ error: 'Usuário não autenticado' });
  }
  req.db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.error('Erro ao verificar autenticação:', err.message);
      return res.status(500).json({ error: 'Erro interno do servidor', details: err.message });
    }
    if (!user) {
      console.warn('Usuário não encontrado:', username);
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }
    req.user = user;
    next();
  });
}

// Middleware para verificar admin
function ensureAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    console.warn(`Acesso negado: ${req.user.username} não é admin`);
    return res.status(403).json({ error: 'Acesso negado: apenas administradores' });
  }
  next();
}

// Rota de registro
router.post('/register', (req, res) => {
  const { username, password, email, role } = req.body;
  console.log('Tentando registrar:', { username, email, role });
  if (!username || !password) {
    console.warn('Username ou senha ausentes');
    return res.status(400).json({ error: 'Username e senha são obrigatórios' });
  }
  if (!['user', 'admin'].includes(role)) {
    console.warn('Papel inválido:', role);
    return res.status(400).json({ error: 'Papel inválido. Use "user" ou "admin"' });
  }
  req.db.get('SELECT username, email FROM users WHERE username = ? OR email = ?', [username, email], (err, existingUser) => {
    if (err) {
      console.error('Erro ao verificar usuário:', err.message);
      return res.status(500).json({ error: 'Erro interno do servidor', details: err.message });
    }
    if (existingUser) {
      console.warn('Usuário ou e-mail já existe:', username, email);
      return res.status(400).json({ error: 'Usuário ou e-mail já existe' });
    }
    const hashedPassword = bcrypt.hashSync(password, 10);
    const newUser = {
      username,
      password: hashedPassword,
      email: email || '',
      birthdate: '',
      specialDate: '',
      role,
      createdAt: new Date().toISOString(),
      lastLogin: null
    };
    req.db.run(`
      INSERT INTO users (username, password, email, birthdate, specialDate, role, createdAt, lastLogin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newUser.username,
      newUser.password,
      newUser.email,
      newUser.birthdate,
      newUser.specialDate,
      newUser.role,
      newUser.createdAt,
      newUser.lastLogin
    ], (err) => {
      if (err) {
        console.error('Erro ao registrar usuário:', err.message);
        return res.status(500).json({ error: 'Erro ao registrar usuário', details: err.message });
      }
      console.log('Usuário registrado:', newUser.username);
      res.status(201).json({ message: 'Registro bem-sucedido', user: newUser });
    });
  });
});

// Rota de login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  console.log('Iniciando login para:', { username });
  if (!username || !password) {
    console.warn('Username ou senha ausentes');
    return res.status(400).json({ error: 'Username e senha são obrigatórios' });
  }
  req.db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.error('Erro ao verificar login:', err.message);
      return res.status(500).json({ error: 'Erro interno do servidor', details: err.message });
    }
    if (!user) {
      console.warn('Usuário não encontrado:', username);
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }
    if (!bcrypt.compareSync(password, user.password)) {
      console.warn('Senha incorreta para usuário:', username);
      return res.status(401).json({ error: 'Senha incorreta' });
    }
    console.log('Login bem-sucedido:', { username, role: user.role });
    req.db.run('UPDATE users SET lastLogin = ? WHERE username = ?', [new Date().toISOString(), username], (err) => {
      if (err) console.error('Erro ao atualizar lastLogin:', err.message);
    });
    res.json({ username: user.username, role: user.role, email: user.email, message: 'Login bem-sucedido' });
  });
});

// Rota de logout
router.get('/logout', (req, res) => {
  console.log('Logout requisitado');
  res.json({ message: 'Logout bem-sucedido' });
});

// CRUD de Usuários
router.get('/users', ensureAuthenticated, ensureAdmin, (req, res) => {
  req.db.all('SELECT * FROM users', (err, users) => {
    if (err) {
      console.error('Erro ao carregar usuários:', err.message);
      return res.status(500).json({ error: 'Erro ao carregar usuários', details: err.message });
    }
    console.log('Usuários carregados:', users.length);
    res.json(users);
  });
});

router.post('/users', ensureAuthenticated, ensureAdmin, (req, res) => {
  const { username, password, email, birthdate, specialDate, role } = req.body;
  req.db.get('SELECT username, email FROM users WHERE username = ? OR email = ?', [username, email], (err, existingUser) => {
    if (err) {
      console.error('Erro ao verificar usuário:', err.message);
      return res.status(500).json({ error: 'Erro ao adicionar usuário', details: err.message });
    }
    if (existingUser) {
      console.warn('Usuário ou e-mail já existe:', username, email);
      return res.status(400).json({ error: 'Usuário ou e-mail já existe' });
    }
    const hashedPassword = bcrypt.hashSync(password, 10);
    const newUser = {
      username,
      password: hashedPassword,
      email: email || '',
      birthdate: birthdate || '',
      specialDate: specialDate || '',
      role: role || 'user',
      createdAt: new Date().toISOString(),
      lastLogin: null
    };
    req.db.run(`
      INSERT INTO users (username, password, email, birthdate, specialDate, role, createdAt, lastLogin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newUser.username,
      newUser.password,
      newUser.email,
      newUser.birthdate,
      newUser.specialDate,
      newUser.role,
      newUser.createdAt,
      newUser.lastLogin
    ], (err) => {
      if (err) {
        console.error('Erro ao adicionar usuário:', err.message);
        return res.status(500).json({ error: 'Erro ao adicionar usuário', details: err.message });
      }
      console.log('Usuário salvo:', newUser.username);
      res.status(201).json(newUser);
    });
  });
});

router.delete('/users/:username', ensureAuthenticated, ensureAdmin, (req, res) => {
  if (req.params.username === req.user.username) {
    console.warn('Tentativa de autoexclusão:', req.user.username);
    return res.status(400).json({ error: 'Não é possível excluir o próprio usuário' });
  }
  req.db.run('DELETE FROM users WHERE username = ?', [req.params.username], (err) => {
    if (err) {
      console.error('Erro ao excluir usuário:', err.message);
      return res.status(500).json({ error: 'Erro ao excluir usuário', details: err.message });
    }
    console.log('Usuário excluído:', req.params.username);
    res.status(204).send();
  });
});

// CRUD de Contatos
router.get('/contacts', ensureAuthenticated, (req, res) => {
  const query = req.user.role === 'admin'
    ? 'SELECT * FROM contacts'
    : 'SELECT * FROM contacts WHERE createdBy = ?';
  const params = req.user.role === 'admin' ? [] : [req.user.username];
  req.db.all(query, params, (err, contacts) => {
    if (err) {
      console.error('Erro ao carregar contatos:', err.message);
      return res.status(500).json({ error: 'Erro ao carregar contatos', details: err.message });
    }
    console.log('Contatos carregados:', contacts.length);
    res.json(contacts);
  });
});

router.post('/contacts', ensureAuthenticated, (req, res) => {
  const { name, phone, email, category, birthday } = req.body;
  const phoneRegex = /^(\+258)?\d{9}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!name || !phone) {
    console.warn('Nome ou telefone ausentes');
    return res.status(400).json({ error: 'Nome e telefone são obrigatórios' });
  }
  if (!phoneRegex.test(phone)) {
    console.warn('Telefone inválido:', phone);
    return res.status(400).json({ error: 'Telefone deve ter 9 dígitos ou começar com +258 seguido de 9 dígitos' });
  }
  if (email && !emailRegex.test(email)) {
    console.warn('E-mail inválido:', email);
    return res.status(400).json({ error: 'E-mail inválido' });
  }
  const newContact = {
    id: uuidv4(),
    name,
    phone,
    email: email || '',
    category: category || '',
    birthday: birthday || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    interactions: 0,
    lastInteraction: null,
    createdBy: req.user.username,
    isValid: true
  };
  req.db.run(`
    INSERT INTO contacts (id, name, phone, email, category, birthday, createdAt, updatedAt, interactions, lastInteraction, createdBy, isValid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    newContact.id,
    newContact.name,
    newContact.phone,
    newContact.email,
    newContact.category,
    newContact.birthday,
    newContact.createdAt,
    newContact.updatedAt,
    newContact.interactions,
    newContact.lastInteraction,
    newContact.createdBy,
    newContact.isValid
  ], (err) => {
    if (err) {
      console.error('Erro ao adicionar contato:', err.message);
      return res.status(500).json({ error: 'Erro ao adicionar contato', details: err.message });
    }
    console.log('Contato adicionado:', newContact.name);
    res.status(201).json(newContact);
  });
});

router.put('/contacts/:id', ensureAuthenticated, (req, res) => {
  const { name, phone, email, category, birthday } = req.body;
  const phoneRegex = /^(\+258)?\d{9}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!name || !phone) {
    console.warn('Nome ou telefone ausentes');
    return res.status(400).json({ error: 'Nome e telefone são obrigatórios' });
  }
  if (!phoneRegex.test(phone)) {
    console.warn('Telefone inválido:', phone);
    return res.status(400).json({ error: 'Telefone deve ter 9 dígitos ou começar com +258 seguido de 9 dígitos' });
  }
  if (email && !emailRegex.test(email)) {
    console.warn('E-mail inválido:', email);
    return res.status(400).json({ error: 'E-mail inválido' });
  }
  req.db.get('SELECT * FROM contacts WHERE id = ? AND createdBy = ?', [req.params.id, req.user.username], (err, contact) => {
    if (err) {
      console.error('Erro ao verificar contato:', err.message);
      return res.status(500).json({ error: 'Erro ao atualizar contato', details: err.message });
    }
    if (!contact && req.user.role !== 'admin') {
      console.warn('Acesso negado ou contato não encontrado:', req.params.id);
      return res.status(403).json({ error: 'Acesso negado ou contato não encontrado' });
    }
    req.db.run(`
      UPDATE contacts
      SET name = ?, phone = ?, email = ?, category = ?, birthday = ?, updatedAt = ?, isValid = ?
      WHERE id = ?
    `, [
      name,
      phone,
      email || '',
      category || '',
      birthday || '',
      new Date().toISOString(),
      true,
      req.params.id
    ], (err) => {
      if (err) {
        console.error('Erro ao atualizar contato:', err.message);
        return res.status(500).json({ error: 'Erro ao atualizar contato', details: err.message });
      }
      console.log('Contato atualizado:', req.params.id);
      res.json({ message: 'Contato atualizado' });
    });
  });
});

router.delete('/contacts/:id', ensureAuthenticated, (req, res) => {
  req.db.get('SELECT * FROM contacts WHERE id = ? AND createdBy = ?', [req.params.id, req.user.username], (err, contact) => {
    if (err) {
      console.error('Erro ao verificar contato:', err.message);
      return res.status(500).json({ error: 'Erro ao excluir contato', details: err.message });
    }
    if (!contact && req.user.role !== 'admin') {
      console.warn('Acesso negado ou contato não encontrado:', req.params.id);
      return res.status(403).json({ error: 'Acesso negado ou contato não encontrado' });
    }
    req.db.run('DELETE FROM contacts WHERE id = ?', [req.params.id], (err) => {
      if (err) {
        console.error('Erro ao excluir contato:', err.message);
        return res.status(500).json({ error: 'Erro ao excluir contato', details: err.message });
      }
      console.log('Contato excluído:', req.params.id);
      res.status(204).send();
    });
  });
});

// Registrar interação
router.post('/contacts/:id/interact', ensureAuthenticated, (req, res) => {
  req.db.get('SELECT * FROM contacts WHERE id = ?', [req.params.id], (err, contact) => {
    if (err) {
      console.error('Erro ao verificar contato:', err.message);
      return res.status(500).json({ error: 'Erro ao registrar interação', details: err.message });
    }
    if (!contact) {
      console.warn('Contato não encontrado:', req.params.id);
      return res.status(404).json({ error: 'Contato não encontrado' });
    }
    req.db.run(`
      UPDATE contacts
      SET interactions = interactions + 1, lastInteraction = ?
      WHERE id = ?
    `, [new Date().toISOString(), req.params.id], (err) => {
      if (err) {
        console.error('Erro ao registrar interação:', err.message);
        return res.status(500).json({ error: 'Erro ao registrar interação', details: err.message });
      }
      console.log('Interação registrada para contato:', req.params.id);
      res.json({ message: 'Interação registrada' });
    });
  });
});

// Relatórios
router.get('/reports/category', ensureAuthenticated, ensureAdmin, (req, res) => {
  console.log(`Carregando relatório de contatos por categoria para ${req.user.username}`);
  req.db.all(`
    SELECT category, COUNT(*) as count
    FROM contacts
    GROUP BY category
  `, (err, data) => {
    if (err) {
      console.error('Erro ao carregar relatório de categorias:', err.message);
      return res.status(500).json({ error: 'Erro ao carregar relatório', details: err.message });
    }
    console.log('Relatório de categorias carregado:', data);
    res.json(data);
  });
});

router.get('/reports/active-inactive', ensureAuthenticated, ensureAdmin, (req, res) => {
  console.log(`Carregando relatório de contatos ativos/inativos para ${req.user.username}`);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  req.db.get(`
    SELECT
      (SELECT COUNT(*) FROM contacts WHERE lastInteraction >= ? OR lastInteraction IS NULL) as active,
      (SELECT COUNT(*) FROM contacts WHERE lastInteraction < ? AND lastInteraction IS NOT NULL) as inactive
  `, [thirtyDaysAgo.toISOString(), thirtyDaysAgo.toISOString()], (err, data) => {
    if (err) {
      console.error('Erro ao carregar relatório de ativos/inativos:', err.message);
      return res.status(500).json({ error: 'Erro ao carregar relatório', details: err.message });
    }
    console.log('Relatório de ativos/inativos carregado:', data);
    res.json(data);
  });
});

router.get('/reports/recent-updates', ensureAuthenticated, ensureAdmin, (req, res) => {
  console.log(`Carregando relatório de atualizações recentes para ${req.user.username}`);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  req.db.all(`
    SELECT name, updatedAt
    FROM contacts
    WHERE updatedAt >= ?
    ORDER BY updatedAt DESC
    LIMIT 10
  `, [sevenDaysAgo.toISOString()], (err, data) => {
    if (err) {
      console.error('Erro ao carregar relatório de atualizações recentes:', err.message);
      return res.status(500).json({ error: 'Erro ao carregar relatório', details: err.message });
    }
    console.log('Relatório de atualizações recentes carregado:', data);
    res.json(data);
  });
});

router.get('/reports/birthdays', ensureAuthenticated, ensureAdmin, (req, res) => {
  console.log(`Carregando relatório de aniversários para ${req.user.username}`);
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  req.db.all(`
    SELECT name, birthday as date, 'Aniversário' as type
    FROM contacts
    WHERE CAST(SUBSTR(birthday, 6, 2) AS INTEGER) = ? 
      AND CAST(SUBSTR(birthday, 9, 2) AS INTEGER) >= ?
    LIMIT 10
  `, [month, day], (err, data) => {
    if (err) {
      console.error('Erro ao carregar relatório de aniversários:', err.message);
      return res.status(500).json({ error: 'Erro ao carregar relatório', details: err.message });
    }
    console.log('Relatório de aniversários carregado:', data);
    res.json(data);
  });
});

router.get('/reports/interaction-frequency', ensureAuthenticated, ensureAdmin, (req, res) => {
  console.log(`Carregando relatório de frequência de interação para ${req.user.username}`);
  req.db.all(`
    SELECT name, interactions
    FROM contacts
    ORDER BY interactions DESC
    LIMIT 10
  `, (err, data) => {
    if (err) {
      console.error('Erro ao carregar relatório de frequência de interação:', err.message);
      return res.status(500).json({ error: 'Erro ao carregar relatório', details: err.message });
    }
    console.log('Relatório de frequência de interação carregado:', data);
    res.json(data);
  });
});

router.get('/reports/growth', ensureAuthenticated, ensureAdmin, (req, res) => {
  console.log(`Carregando relatório de crescimento para ${req.user.username}`);
  req.db.all(`
    SELECT strftime('%Y-%m', createdAt) as month, COUNT(*) as count
    FROM contacts
    GROUP BY strftime('%Y-%m', createdAt)
    ORDER BY month DESC
    LIMIT 12
  `, (err, data) => {
    if (err) {
      console.error('Erro ao carregar relatório de crescimento:', err.message);
      return res.status(500).json({ error: 'Erro ao carregar relatório', details: err.message });
    }
    console.log('Relatório de crescimento carregado:', data);
    res.json(data);
  });
});

router.get('/reports/contact-failures', ensureAuthenticated, ensureAdmin, (req, res) => {
  console.log(`Carregando relatório de falhas de contato para ${req.user.username}`);
  const phoneRegex = /^(\+258)?\d{9}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  req.db.all('SELECT name, phone, email FROM contacts', (err, contacts) => {
    if (err) {
      console.error('Erro ao carregar contatos para relatório de falhas:', err.message);
      return res.status(500).json({ error: 'Erro ao carregar relatório', details: err.message });
    }
    const failures = contacts.filter(contact => {
      const phoneValid = phoneRegex.test(contact.phone);
      const emailValid = !contact.email || emailRegex.test(contact.email);
      return !phoneValid || !emailValid;
    }).map(contact => ({
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      issues: [
        !phoneRegex.test(contact.phone) ? 'Telefone inválido' : null,
        contact.email && !emailRegex.test(contact.email) ? 'E-mail inválido' : null
      ].filter(Boolean)
    }));
    console.log('Relatório de falhas de contato carregado:', failures);
    res.json(failures);
  });
});

module.exports = router;