const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

module.exports = function initDB(db) {
  console.log('Inicializando banco de dados...');
  db.serialize(() => {
    // Dropar tabelas existentes
    db.run(`DROP TABLE IF EXISTS users`, (err) => {
      if (err) console.error('Erro ao dropar tabela users:', err.message);
    });
    db.run(`DROP TABLE IF EXISTS contacts`, (err) => {
      if (err) console.error('Erro ao dropar tabela contacts:', err.message);
    });

    // Criar tabela users
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        email TEXT UNIQUE,
        birthdate TEXT,
        specialDate TEXT,
        role TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        lastLogin TEXT
      )
    `, (err) => {
      if (err) console.error('Erro ao criar tabela users:', err.message);
      else console.log('Tabela users criada');
    });

    // Criar tabela contacts
    db.run(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        category TEXT,
        birthday TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        interactions INTEGER DEFAULT 0,
        lastInteraction TEXT,
        createdBy TEXT NOT NULL,
        isValid BOOLEAN DEFAULT 1,
        FOREIGN KEY(createdBy) REFERENCES users(username)
      )
    `, (err) => {
      if (err) console.error('Erro ao criar tabela contacts:', err.message);
      else console.log('Tabela contacts criada');
    });

    // Criar índice para createdBy
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_contacts_createdBy ON contacts(createdBy)
    `, (err) => {
      if (err) console.error('Erro ao criar índice idx_contacts_createdBy:', err.message);
      else console.log('Índice idx_contacts_createdBy criado');
    });

    // Inserir usuários padrão
    const users = [
      {
        username: 'admin',
        password: bcrypt.hashSync('admin123', 10),
        email: 'admin@example.com',
        birthdate: '1990-01-01',
        specialDate: '2025-12-25',
        role: 'admin',
        createdAt: new Date().toISOString()
      },
      {
        username: 'user',
        password: bcrypt.hashSync('user123', 10),
        email: 'user@example.com',
        birthdate: '1995-06-15',
        specialDate: '2025-10-10',
        role: 'user',
        createdAt: new Date().toISOString()
      },
      {
        username: 'jose',
        password: bcrypt.hashSync('jose123', 10),
        email: 'jose@example.com',
        birthdate: '1990-05-14',
        specialDate: null,
        role: 'user',
        createdAt: new Date().toISOString()
      }
    ];

    users.forEach(user => {
      db.get('SELECT username, email FROM users WHERE username = ? OR email = ?', [user.username, user.email], (err, row) => {
        if (err) console.error('Erro ao verificar usuário:', err.message);
        if (!row) {
          db.run(`
            INSERT INTO users (username, password, email, birthdate, specialDate, role, createdAt, lastLogin)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            user.username,
            user.password,
            user.email,
            user.birthdate,
            user.specialDate,
            user.role,
            user.createdAt,
            null
          ], (err) => {
            if (err) console.error('Erro ao inserir usuário:', err.message);
            else console.log(`Usuário padrão ${user.username} criado`);
          });
        } else {
          console.log(`Usuário ${user.username} ou e-mail ${user.email} já existe`);
        }
      });
    });

    // Inserir contatos padrão
    const contacts = [
      {
        id: uuidv4(),
        name: 'José',
        phone: '848583746',
        email: 'jm3136014@gmail.com',
        category: 'Amigos',
        birthday: '2004-06-27',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        interactions: 5,
        lastInteraction: new Date().toISOString(),
        createdBy: 'jose',
        isValid: true
      },
      {
        id: uuidv4(),
        name: 'Maria',
        phone: '849123456',
        email: 'maria@example.com',
        category: 'Família',
        birthday: '1990-05-14',
        createdAt: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString(),
        updatedAt: new Date().toISOString(),
        interactions: 2,
        lastInteraction: new Date(new Date().setDate(new Date().getDate() - 10)).toISOString(),
        createdBy: 'admin',
        isValid: true
      },
      {
        id: uuidv4(),
        name: 'Pedro',
        phone: '847654321',
        email: 'pedro@invalid', // E-mail inválido para teste de falhas
        category: 'Trabalho',
        birthday: '1985-05-20',
        createdAt: new Date(new Date().setMonth(new Date().getMonth() - 2)).toISOString(),
        updatedAt: new Date(new Date().setDate(new Date().getDate() - 5)).toISOString(),
        interactions: 0,
        lastInteraction: null,
        createdBy: 'admin',
        isValid: false
      }
    ];

    contacts.forEach(contact => {
      db.get('SELECT id FROM contacts WHERE id = ?', [contact.id], (err, row) => {
        if (err) console.error('Erro ao verificar contato:', err.message);
        if (!row) {
          db.run(`
            INSERT INTO contacts (id, name, phone, email, category, birthday, createdAt, updatedAt, interactions, lastInteraction, createdBy, isValid)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            contact.id,
            contact.name,
            contact.phone,
            contact.email,
            contact.category,
            contact.birthday,
            contact.createdAt,
            contact.updatedAt,
            contact.interactions,
            contact.lastInteraction,
            contact.createdBy,
            contact.isValid
          ], (err) => {
            if (err) console.error('Erro ao inserir contato:', err.message);
            else console.log(`Contato padrão ${contact.name} criado`);
          });
        } else {
          console.log(`Contato ${contact.name} já existe`);
        }
      });
    });
  });
};