require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== SISTEMA DE PING 24/7 ====================
console.log('🚀 Iniciando sistema 24/7...');

// Función para mantener activo el servidor
const startPingSystem = () => {
  console.log('🔄 Sistema de ping 24/7 activado');
  
  // Ping interno cada 4 minutos (menos de 5 para evitar sleep)
  setInterval(() => {
    const now = new Date();
    console.log(`[${now.toLocaleTimeString()}] 🔄 Ping automático para mantener activo`);
    
    // Hacer request a la propia app
    const http = require('http');
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: '/health',
      method: 'GET',
      timeout: 5000
    };
    
    const req = http.request(options, (res) => {
      console.log(`[${now.toLocaleTimeString()}] ✅ Ping interno exitoso`);
    });
    
    req.on('error', () => {});
    req.on('timeout', () => {
      req.destroy();
    });
    
    req.end();
  }, 4 * 60 * 1000); // 4 minutos
  
  console.log('✅ Sistema de ping programado cada 4 minutos');
};

// ==================== CONFIGURACIÓN POSTGRESQL ====================
const pool = new Pool({
  connectionString: 'postgresql://victorias_admin:7TB4EZxUJz4uBM8y9cVfuIor6WjHo8ZD@dpg-d5c3u3f5r7bs73aouo60-a/victorias_db',
  ssl: {
    rejectUnauthorized: false
  }
});

// ==================== FUNCIONES DE BASE DE DATOS ====================
const createTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS citas (
        id SERIAL PRIMARY KEY,
        whatsapp_number VARCHAR(20) NOT NULL,
        customer_name VARCHAR(100) NOT NULL,
        service_type VARCHAR(100) NOT NULL,
        appointment_date DATE NOT NULL,
        appointment_time TIME NOT NULL,
        duration_minutes INT DEFAULT 60,
        status VARCHAR(20) DEFAULT 'pendiente',
        price DECIMAL(10, 2),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const adminExists = await pool.query(
      'SELECT * FROM admins WHERE username = $1',
      ['admin']
    );

    if (adminExists.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await pool.query(
        'INSERT INTO admins (username, password_hash) VALUES ($1, $2)',
        ['admin', hashedPassword]
      );
      console.log('✅ Admin creado: usuario=admin, contraseña=admin123');
    }

    console.log('✅ Tablas PostgreSQL listas');
  } catch (error) {
    console.error('❌ Error creando tablas:', error.message);
  }
};

// Inicializar tablas con retardo
setTimeout(() => {
  createTables();
}, 3000);

// FUNCIONES DE BASE DE DATOS
const db = {
  async saveAppointment(appointmentData) {
    const {
      whatsapp_number,
      customer_name,
      service_type,
      appointment_date,
      appointment_time,
      duration_minutes = 60,
      price = 0
    } = appointmentData;

    const query = `
      INSERT INTO citas 
      (whatsapp_number, customer_name, service_type, appointment_date, 
       appointment_time, duration_minutes, price, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendiente')
      RETURNING id
    `;

    const values = [
      whatsapp_number,
      customer_name,
      service_type,
      appointment_date,
      appointment_time,
      duration_minutes,
      price
    ];

    try {
      const result = await pool.query(query, values);
      return { success: true, id: result.rows[0].id };
    } catch (error) {
      console.error('❌ Error guardando cita:', error.message);
      return { success: false, error: error.message };
    }
  },

  async getAllAppointments() {
    try {
      const result = await pool.query(`
        SELECT *, 
               TO_CHAR(appointment_date, 'DD/MM/YYYY') as fecha_formateada,
               TO_CHAR(appointment_time, 'HH24:MI') as hora_formateada
        FROM citas 
        ORDER BY appointment_date DESC, appointment_time DESC
      `);
      return result.rows;
    } catch (error) {
      console.error('❌ Error obteniendo citas:', error.message);
      return [];
    }
  },

  async getStats() {
    try {
      const totalQuery = await pool.query('SELECT COUNT(*) as total FROM citas');
      const pendingQuery = await pool.query(
        "SELECT COUNT(*) as pending FROM citas WHERE status = 'pendiente'"
      );
      const completedQuery = await pool.query(
        "SELECT COUNT(*) as completed FROM citas WHERE status = 'completada'"
      );
      const revenueQuery = await pool.query(
        "SELECT SUM(price) as revenue FROM citas WHERE status = 'completada'"
      );

      return {
        total: parseInt(totalQuery.rows[0].total || 0),
        pending: parseInt(pendingQuery.rows[0].pending || 0),
        completed: parseInt(completedQuery.rows[0].completed || 0),
        revenue: parseFloat(revenueQuery.rows[0].revenue || 0)
      };
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error.message);
      return { total: 0, pending: 0, completed: 0, revenue: 0 };
    }
  },

  async updateAppointmentStatus(id, status) {
    try {
      await pool.query(
        'UPDATE citas SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [status, id]
      );
      return { success: true };
    } catch (error) {
      console.error('❌ Error actualizando estado:', error.message);
      return { success: false, error: error.message };
    }
  },

  async verifyAdmin(username, password) {
    try {
      const result = await pool.query(
        'SELECT * FROM admins WHERE username = $1',
        [username]
      );

      if (result.rows.length === 0) {
        return { valid: false, message: 'Usuario no encontrado' };
      }

      const admin = result.rows[0];
      const isValid = await bcrypt.compare(password, admin.password_hash);

      return {
        valid: isValid,
        user: isValid ? { id: admin.id, username: admin.username } : null,
        message: isValid ? 'Login exitoso' : 'Contraseña incorrecta'
      };
    } catch (error) {
      console.error('❌ Error verificando admin:', error.message);
      return { valid: false, message: 'Error del servidor' };
    }
  },

  // NUEVAS FUNCIONES PARA EL BOT MEJORADO
  async hasActiveAppointment(whatsappNumber) {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) as count 
         FROM citas 
         WHERE whatsapp_number = $1 
         AND status = 'pendiente' 
         AND appointment_date >= CURRENT_DATE`,
        [whatsappNumber]
      );
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      console.error('❌ Error verificando citas activas:', error.message);
      return false;
    }
  },

  async getUserAppointments(whatsappNumber) {
    try {
      const result = await pool.query(
        `SELECT *, 
                TO_CHAR(appointment_date, 'DD/MM/YYYY') as fecha_formateada,
                TO_CHAR(appointment_time, 'HH24:MI') as hora_formateada
         FROM citas 
         WHERE whatsapp_number = $1 
         AND status = 'pendiente'
         ORDER BY appointment_date, appointment_time`,
        [whatsappNumber]
      );
      return result.rows;
    } catch (error) {
      console.error('❌ Error obteniendo citas de usuario:', error.message);
      return [];
    }
  },

  async getAvailableTimeSlots(date) {
    try {
      const allSlots = [
        '10:00', '11:00', '12:00', '13:00', '14:00', 
        '15:00', '16:00', '17:00', '18:00', '19:00'
      ];
      
      const result = await pool.query(
        `SELECT appointment_time 
         FROM citas 
         WHERE appointment_date = $1 
         AND status = 'pendiente'`,
        [date]
      );
      
      const occupiedSlots = result.rows.map(row => 
        row.appointment_time.substring(0, 5)
      );
      
      const availableSlots = allSlots.filter(slot => 
        !occupiedSlots.includes(slot)
      );
      
      return availableSlots;
    } catch (error) {
      console.error('❌ Error obteniendo horarios disponibles:', error.message);
      return [];
    }
  },

  async updateAppointmentDateTime(id, newDate, newTime) {
    try {
      await pool.query(
        `UPDATE citas 
         SET appointment_date = $1, 
             appointment_time = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [newDate, newTime, id]
      );
      return { success: true };
    } catch (error) {
      console.error('❌ Error actualizando fecha/hora:', error.message);
      return { success: false, error: error.message };
    }
  },

  async deleteAppointment(id, whatsappNumber) {
    try {
      const result = await pool.query(
        `DELETE FROM citas 
         WHERE id = $1 
         AND whatsapp_number = $2 
         AND status = 'pendiente'
         RETURNING id`,
        [id, whatsappNumber]
      );
      
      if (result.rows.length > 0) {
        return { success: true, message: 'Cita eliminada' };
      } else {
        return { success: false, message: 'No se pudo eliminar la cita' };
      }
    } catch (error) {
      console.error('❌ Error eliminando cita:', error.message);
      return { success: false, error: error.message };
    }
  }
};

// ==================== CONFIGURACIÓN EXPRESS ====================
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(session({
  secret: 'victorias-secret-key-' + Date.now(),
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

const requireAuth = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/admin/login');
  }
};

// ==================== SERVICIOS VÁLIDOS ====================
const serviciosValidos = {
  'corte': 100,
  'corte dama': 100,
  'corte caballero': 100,
  'corte niños': 100,
  'fleco': 50,
  'barba': 50,
  'shampoo': 50,
  'bob': 350,
  'depilacion facial': 80,
  'planchado ceja': 200,
  'rizado pestañas': 200,
  'alaciado express': 250,
  'tinte': 350,
  'peinado': 450,
  'maquillaje': 500,
  'maquillaje con pestañas': 500,
  'peinado y maquillaje': 950,
  'efecto de color': 1050,
  'keratina': 950,
  'botox': 900,
  'manicure': 220,
  'gelish': 150,
  'pedicure': 320,
  'unas esculturales': 250,
  'rubber': 200,
  'limpieza facial': 450
};

const userStates = {};

// ==================== FUNCIONES AUXILIARES ====================
function normalizeText(text) {
  return text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function findService(userInput) {
  const normalized = normalizeText(userInput);
  
  for (const [service, price] of Object.entries(serviciosValidos)) {
    if (normalized === normalizeText(service)) {
      return { service: service, price: price, exact: true };
    }
  }
  
  for (const [service, price] of Object.entries(serviciosValidos)) {
    if (normalized.includes(normalizeText(service)) || normalizeText(service).includes(normalized)) {
      return { service: service, price: price, exact: false };
    }
  }
  
  return null;
}

function formatServicesList() {
  let services = '';
  services += 'CORTE:\n';
  services += '• Corte (dama, caballero, niños) - $100\n';
  services += '• Fleco, barba o shampoo - $50\n';
  services += '• Bob - $350\n\n';
  services += 'UÑAS:\n';
  services += '• Manicure (gel) - $220\n';
  services += '• Pedicure (gel) - $320\n';
  services += '• Uñas Esculturales - desde $250\n\n';
  services += 'COLOR/TRATAMIENTO:\n';
  services += '• Efecto de color - desde $1050\n';
  services += '• Keratina - $950/onza\n';
  services += '• Botox - $900\n\n';
  services += 'BELLEZA:\n';
  services += '• Depilación facial - $80/área\n';
  services += '• Maquillaje (con pestañas) - $500\n';
  services += '• Peinado y maquillaje - $950\n';
  return services;
}

function isValidDate(dateString) {
  const regex = /^\d{1,2}\/\d{1,2}$/;
  if (!regex.test(dateString)) return false;
  
  const [day, month] = dateString.split('/').map(Number);
  const currentYear = new Date().getFullYear();
  const date = new Date(currentYear, month - 1, day);
  
  return date.getFullYear() === currentYear && 
         date.getMonth() === month - 1 && 
         date.getDate() === day;
}

function isValidTime(timeString) {
  const regex = /^\d{1,2}:\d{2}$/;
  if (!regex.test(timeString)) return false;
  
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours >= 10 && hours <= 20 && minutes >= 0 && minutes < 60;
}

// ==================== RUTAS DE SALUD Y MONITOREO ====================
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: "Victoria's Bot",
    version: '2.0'
  });
});

app.get('/ping', (req, res) => {
  console.log(`[${new Date().toLocaleTimeString()}] 🌐 Ping recibido de ${req.ip || 'unknown'}`);
  res.json({ 
    status: 'pong',
    time: new Date().toISOString(),
    server: 'Victoria\'s WhatsApp Bot'
  });
});

app.get('/status', (req, res) => {
  res.json({
    online: true,
    lastPing: new Date().toISOString(),
    database: 'connected',
    whatsapp: 'active',
    uptime: process.uptime()
  });
});

// ==================== RUTA HOME MEJORADA ====================
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Victoria's Bot - 24/7 Activo</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
        h1 { color: #4a5568; }
        .status { background: #e6fffa; padding: 20px; border-radius: 10px; margin: 20px 0; }
        .online { color: #38a169; font-weight: bold; background: #d1fae5; padding: 5px 15px; border-radius: 20px; }
        .btn { display: inline-block; background: #4299e1; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 10px; font-weight: bold; }
        .btn:hover { background: #3182ce; }
        .ping-info { background: #f7fafc; padding: 15px; border-radius: 8px; margin-top: 20px; font-size: 14px; color: #718096; }
        .badge { background: #10b981; color: white; padding: 5px 10px; border-radius: 12px; font-size: 12px; display: inline-block; margin-left: 10px; }
      </style>
      <script>
        // Mantener activa la página
        let lastActivity = Date.now();
        
        document.addEventListener('click', () => lastActivity = Date.now());
        document.addEventListener('mousemove', () => lastActivity = Date.now());
        
        // Ping automático desde el navegador
        setInterval(() => {
          fetch('/ping').then(r => r.json()).then(data => {
            document.getElementById('last-ping').textContent = new Date().toLocaleTimeString();
          }).catch(() => {});
        }, 60000);
        
        // Actualizar contador de actividad
        setInterval(() => {
          const seconds = Math.floor((Date.now() - lastActivity) / 1000);
          document.getElementById('activity-counter').textContent = 
            seconds < 60 ? 'activo ahora' : \`hace \${Math.floor(seconds/60)} min\`;
        }, 10000);
      </script>
    </head>
    <body>
      <div class="container">
        <h1>Victoria's WhatsApp Bot <span class="badge">24/7</span></h1>
        <div class="status">
          <h2>Estado del Sistema</h2>
          <p><strong>Servidor:</strong> <span class="online">EN LÍNEA</span></p>
          <p><strong>Último ping:</strong> <span id="last-ping">${new Date().toLocaleTimeString()}</span></p>
          <p><strong>Actividad:</strong> <span id="activity-counter">activo ahora</span></p>
          <p><strong>Base de datos:</strong> Conectada</p>
          <p><strong>WhatsApp Bot:</strong> Funcionando</p>
        </div>
        <a href="/admin" class="btn">Acceder al Panel Admin</a>
        <a href="/admin/login" class="btn" style="background: #38a169;">Login Directo</a>
        
        <div class="ping-info">
          <p><strong>Sistema 24/7 activado:</strong> Ping automático cada 4 minutos</p>
          <p><small>Este servidor se mantiene activo permanentemente</small></p>
        </div>
        
        <p style="margin-top: 30px; color: #718096;">
          Credenciales: <strong>admin</strong> | <strong>admin123</strong>
        </p>
      </div>
      
      <script>
        // Ping inicial
        fetch('/ping').then(r => r.json()).then(data => {
          document.getElementById('last-ping').textContent = new Date().toLocaleTimeString();
        });
      </script>
    </body>
    </html>
  `);
});

// ==================== PANEL ADMIN ====================
app.get('/admin', requireAuth, async (req, res) => {
  try {
    const stats = await db.getStats();
    const appointments = await db.getAllAppointments();
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Panel Victoria's</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f7fafc; }
          .header { background: #4a5568; color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
          .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
          .stat-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
          table { width: 100%; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-top: 20px; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
          th { background: #edf2f7; }
          .btn { padding: 8px 15px; border: none; border-radius: 5px; cursor: pointer; margin: 2px; }
          .btn-success { background: #38a169; color: white; }
          .btn-danger { background: #e53e3e; color: white; }
          .logout { float: right; background: #718096; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Panel Victoria's - 24/7 Activo</h1>
          <p>Bienvenido, ${req.session.user.username} | <a href="/admin/logout" class="logout">Cerrar sesión</a></p>
        </div>
        
        <div class="stats">
          <div class="stat-card">
            <h3>Citas Totales</h3>
            <h2>${stats.total}</h2>
          </div>
          <div class="stat-card">
            <h3>Pendientes</h3>
            <h2>${stats.pending}</h2>
          </div>
          <div class="stat-card">
            <h3>Completadas</h3>
            <h2>${stats.completed}</h2>
          </div>
          <div class="stat-card">
            <h3>Ingresos</h3>
            <h2>$${stats.revenue}</h2>
          </div>
        </div>
        
        <h2>Citas Agendadas</h2>
        ${appointments.length > 0 ? `
          <table>
            <tr>
              <th>Cliente</th>
              <th>Servicio</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Precio</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
            ${appointments.map(cita => `
              <tr>
                <td>${cita.customer_name}<br><small>${cita.whatsapp_number}</small></td>
                <td>${cita.service_type}</td>
                <td>${cita.fecha_formateada || cita.appointment_date}</td>
                <td>${cita.hora_formateada || cita.appointment_time}</td>
                <td>$${cita.price || '0'}</td>
                <td>
                  <span style="
                    padding: 5px 10px;
                    border-radius: 15px;
                    font-size: 12px;
                    background: ${cita.status === 'pendiente' ? '#fef3c7' : cita.status === 'completada' ? '#d1fae5' : '#fee2e2'};
                    color: ${cita.status === 'pendiente' ? '#92400e' : cita.status === 'completada' ? '#065f46' : '#991b1b'};
                  ">
                    ${cita.status.toUpperCase()}
                  </span>
                </td>
                <td>
                  ${cita.status === 'pendiente' ? `
                    <button class="btn btn-success" onclick="updateStatus(${cita.id}, 'completada')">Completar</button>
                    <button class="btn btn-danger" onclick="updateStatus(${cita.id}, 'cancelada')">Cancelar</button>
                  ` : ''}
                </td>
              </tr>
            `).join('')}
          </table>
        ` : '<p>No hay citas registradas.</p>'}
        
        <script>
          async function updateStatus(id, status) {
            if (confirm('¿Cambiar estado a ' + status + '?')) {
              try {
                const response = await fetch('/api/appointments/' + id + '/status', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status })
                });
                
                if (response.ok) {
                  alert('Estado actualizado');
                  location.reload();
                }
              } catch (error) {
                alert('Error actualizando');
              }
            }
          }
          
          setInterval(() => location.reload(), 30000);
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send('Error cargando el panel: ' + error.message);
  }
});

// ==================== LOGIN ====================
app.get('/admin/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Login - Victoria's</title>
      <style>
        body { font-family: Arial; text-align: center; padding: 50px; }
        .login-box { max-width: 400px; margin: 0 auto; padding: 30px; border: 1px solid #ddd; border-radius: 10px; }
        input { width: 100%; padding: 10px; margin: 10px 0; }
        button { width: 100%; padding: 10px; background: #4299e1; color: white; border: none; cursor: pointer; }
      </style>
    </head>
    <body>
      <div class="login-box">
        <h2>Panel Victoria's</h2>
        <form action="/admin/login" method="POST">
          <input type="text" name="username" placeholder="Usuario" required>
          <input type="password" name="password" placeholder="Contraseña" required>
          <button type="submit">Ingresar</button>
        </form>
        <p style="margin-top: 20px;">
          Usuario: <strong>admin</strong><br>
          Contraseña: <strong>admin123</strong>
        </p>
      </div>
    </body>
    </html>
  `);
});

app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const result = await db.verifyAdmin(username, password);
  
  if (result.valid) {
    req.session.user = result.user;
    res.redirect('/admin');
  } else {
    res.redirect('/admin/login');
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// ==================== API ====================
app.get('/api/appointments', requireAuth, async (req, res) => {
  try {
    const appointments = await db.getAllAppointments();
    res.json({ success: true, data: appointments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/appointments/:id/status', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await db.updateAppointmentStatus(id, status);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== WEBHOOK WHATSAPP COMPLETO ====================
app.post('/webhook', async (req, res) => {
  console.log(`[${new Date().toLocaleTimeString()}] 📱 Webhook WhatsApp recibido`);
  
  try {
    const twilio = require('twilio');
    const MessagingResponse = twilio.twiml.MessagingResponse;
    const twiml = new MessagingResponse();
    
    const message = (req.body.Body || '').toLowerCase().trim();
    const from = req.body.From.replace('whatsapp:', '');
    
    console.log(`[${new Date().toLocaleTimeString()}] Mensaje: "${message}" de ${from}`);
    
    // Verificar si tiene citas pendientes (evitar spam)
    const hasActiveAppointment = await db.hasActiveAppointment(from);
    
    // MENSAJE DE BIENVENIDA
    if (message.includes('hola') || message === 'hi' || message === 'hello' || message.includes('ayuda')) {
      twiml.message(`Hola! Soy el asistente de Victoria's Hair Salon

Escribe "AGENDAR" para reservar una cita
Escribe "SERVICIOS" para ver todos nuestros servicios
Escribe "PRECIOS" para ver lista de precios
Escribe "HORARIO" para ver disponibilidad
Escribe "CANCELAR" para cancelar una cita
Escribe "CAMBIO" para cambiar fecha/hora
Escribe "MIS CITAS" para ver tus reservas`);
    }
    
    // MOSTRAR SERVICIOS
    else if (message.includes('servicio')) {
      const servicesList = formatServicesList();
      twiml.message(`SERVICIOS DISPONIBLES - VICTORIA'S HAIR SALON

${servicesList}

Escribe "AGENDAR" para reservar tu servicio favorito`);
    }
    
    // MOSTRAR PRECIOS
    else if (message.includes('precio') || message.includes('costo') || message.includes('cuanto')) {
      twiml.message(`LISTA DE PRECIOS - VICTORIA'S

CORTE:
Corte - $100
Fleco/barba/shampoo - $50
Bob - $350

UÑAS:
Manicure (gel) - $220
Pedicure (gel) - $320
Uñas Esculturales - desde $250

COLOR:
Efecto de color - desde $1050
Aplicación de tinte - $350

BELLEZA:
Maquillaje - $500
Peinado y maquillaje - $950
Depilación facial - $80/área

TRATAMIENTOS:
Keratina - $950/onza
Botox - $900
Alaciado express - $250-$450

HORARIO: Lunes a Sábado 10am - 8pm

Escribe "AGENDAR" para reservar`);
    }
    
    // MOSTRAR HORARIO
    else if (message.includes('horario') || message.includes('disponibilidad')) {
      twiml.message(`HORARIO DE ATENCIÓN - VICTORIA'S

Lunes a Sábado: 10:00 am - 8:00 pm
Domingo: Cerrado

Dirección: Plaza Laguna Local 35
Dr. Alfredo Gochicoa 1020
Col. Volantín, Tampico, Tam.

WhatsApp: 833 435 8628

Escribe "AGENDAR" para reservar tu cita`);
    }
    
    // INICIAR AGENDAMIENTO
    else if (message.includes('agendar') && !hasActiveAppointment) {
      userStates[from] = { step: 'ask_name' };
      twiml.message(`Para agendar en Victoria's Hair Salon, dime:

1. ¿Cuál es tu nombre?`);
    }
    
    // BLOQUEO POR CITA ACTIVA
    else if (message.includes('agendar') && hasActiveAppointment) {
      twiml.message(`Ya tienes una cita activa. Si necesitas cancelarla o modificarla, escribe:

"CANCELAR" - Para eliminar tu cita
"CAMBIO" - Para cambiar fecha/hora
"MIS CITAS" - Para ver tus reservas`);
    }
    
    // CANCELAR CITA
    else if (message.includes('cancelar')) {
      const userAppointments = await db.getUserAppointments(from);
      
      if (userAppointments.length === 0) {
        twiml.message('No tienes citas activas para cancelar.');
      } else if (userAppointments.length === 1) {
        const appointment = userAppointments[0];
        userStates[from] = { step: 'confirm_cancel', appointmentId: appointment.id };
        
        twiml.message(`¿Seguro que quieres cancelar esta cita?

Servicio: ${appointment.service_type}
Fecha: ${appointment.fecha_formateada}
Hora: ${appointment.hora_formateada}

Responde "SI" para confirmar o "NO" para mantenerla.`);
      } else {
        let response = 'Tienes varias citas. Indica cuál quieres cancelar:\n\n';
        userAppointments.forEach((app, index) => {
          response += `${index + 1}. ${app.service_type} - ${app.fecha_formateada} ${app.hora_formateada}\n`;
        });
        response += '\nResponde con el número de la cita.';
        
        userStates[from] = { step: 'select_cancel', appointments: userAppointments };
        twiml.message(response);
      }
    }
    
    // CAMBIAR CITA
    else if (message.includes('cambio') || message.includes('modificar') || message.includes('cambiar')) {
      const userAppointments = await db.getUserAppointments(from);
      
      if (userAppointments.length === 0) {
        twiml.message('No tienes citas para modificar.');
      } else if (userAppointments.length === 1) {
        const appointment = userAppointments[0];
        userStates[from] = { 
          step: 'ask_new_date', 
          appointmentId: appointment.id,
          currentAppointment: appointment
        };
        
        twiml.message(`¿Qué quieres modificar de tu cita?

Servicio: ${appointment.service_type}
Fecha actual: ${appointment.fecha_formateada}
Hora actual: ${appointment.hora_formateada}

Responde:
"FECHA" - Para cambiar la fecha
"HORA" - Para cambiar la hora
"AMBAS" - Para cambiar fecha y hora`);
      } else {
        let response = 'Tienes varias citas. Indica cuál quieres modificar:\n\n';
        userAppointments.forEach((app, index) => {
          response += `${index + 1}. ${app.service_type} - ${app.fecha_formateada} ${app.hora_formateada}\n`;
        });
        response += '\nResponde con el número de la cita.';
        
        userStates[from] = { step: 'select_change', appointments: userAppointments };
        twiml.message(response);
      }
    }
    
    // VER MIS CITAS
    else if (message.includes('mis citas') || message.includes('mis reservas')) {
      const userAppointments = await db.getUserAppointments(from);
      
      if (userAppointments.length === 0) {
        twiml.message('No tienes citas agendadas.');
      } else {
        let response = 'TUS CITAS AGENDADAS:\n\n';
        userAppointments.forEach((app, index) => {
          response += `${index + 1}. ${app.service_type}\n`;
          response += `   Fecha: ${app.fecha_formateada}\n`;
          response += `   Hora: ${app.hora_formateada}\n`;
          response += `   Precio: $${app.price}\n`;
          response += `   Estado: ${app.status}\n`;
          response += `   ID: ${app.id}\n\n`;
        });
        
        response += 'Escribe "CANCELAR" para eliminar una cita\n';
        response += 'Escribe "CAMBIO" para modificar fecha/hora';
        
        twiml.message(response);
      }
    }
    
    // PROCESAR ESTADOS DE CONVERSACIÓN
    else if (userStates[from]) {
      const state = userStates[from];
      
      // PASO 1: PEDIR NOMBRE
      if (state.step === 'ask_name') {
        userStates[from] = { 
          step: 'ask_service', 
          name: message 
        };
        twiml.message(`Perfecto ${message}. 

2. ¿Qué servicio deseas?

${formatServicesList()}

Escribe el nombre del servicio:`);
      }
      
      // PASO 2: PEDIR SERVICIO (con validación)
      else if (state.step === 'ask_service') {
        const serviceInfo = findService(message);
        
        if (!serviceInfo) {
          twiml.message(`Lo siento, no ofrecemos "${message}". 

Servicios disponibles:
${formatServicesList()}

Por favor, escribe un servicio de la lista:`);
        } else {
          userStates[from] = { 
            step: 'ask_date', 
            name: state.name,
            service: serviceInfo.service,
            price: serviceInfo.price
          };
          
          twiml.message(`Excelente elección. ${serviceInfo.service} - $${serviceInfo.price}

3. ¿Para qué fecha? (Ej: 20/01)
Horario: Lunes a Sábado de 10am a 8pm`);
        }
      }
      
      // PASO 3: PEDIR FECHA (con validación)
      else if (state.step === 'ask_date') {
        if (!isValidDate(message)) {
          twiml.message('Formato de fecha incorrecto. Usa DD/MM (ej: 20/01):');
          return;
        }
        
        const [day, month] = message.split('/');
        const currentYear = new Date().getFullYear();
        const selectedDate = `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        
        const availableSlots = await db.getAvailableTimeSlots(selectedDate);
        
        if (availableSlots.length === 0) {
          twiml.message(`La fecha ${message} está completamente ocupada. 

Por favor, elige otra fecha (ej: 21/01):`);
        } else {
          userStates[from] = { 
            step: 'ask_time', 
            name: state.name,
            service: state.service,
            price: state.price,
            date: selectedDate,
            displayDate: message,
            availableSlots: availableSlots
          };
          
          let timeOptions = 'Horarios disponibles para ' + message + ':\n';
          availableSlots.forEach(slot => {
            timeOptions += `• ${slot}\n`;
          });
          
          twiml.message(`Fecha ${message} disponible.

4. ¿A qué hora? (Ej: 14:00)
Horarios disponibles:
${timeOptions}

Escribe la hora que prefieras:`);
        }
      }
      
      // PASO 4: PEDIR HORA (con validación y disponibilidad)
      else if (state.step === 'ask_time') {
        if (!isValidTime(message)) {
          twiml.message('Formato de hora incorrecto. Usa HH:MM (ej: 14:00):');
          return;
        }
        
        const normalizedTime = message.padStart(5, '0');
        
        if (!state.availableSlots.includes(normalizedTime)) {
          let timeOptions = 'Esa hora no está disponible. Horarios libres:\n';
          state.availableSlots.forEach(slot => {
            timeOptions += `• ${slot}\n`;
          });
          twiml.message(timeOptions);
          return;
        }
        
        const appointmentData = {
          whatsapp_number: from,
          customer_name: state.name,
          service_type: state.service,
          appointment_date: state.date,
          appointment_time: normalizedTime,
          price: state.price
        };
        
        const result = await db.saveAppointment(appointmentData);
        
        if (result.success) {
          delete userStates[from];
          
          twiml.message(`CITA CONFIRMADA

Resumen:
Nombre: ${state.name}
Servicio: ${state.service}
Fecha: ${state.displayDate}
Hora: ${normalizedTime}
Total: $${state.price}
ID Reserva: #${result.id}

Dirección: Plaza Laguna Local 35, Tampico
WhatsApp: 833 435 8628
Horario: Lunes a Sábado 10am-8pm

Gracias por tu reserva!`);
        } else {
          twiml.message('Lo siento, hubo un error al guardar tu cita. Por favor intenta de nuevo.');
        }
      }
      
      // CONFIRMAR CANCELACIÓN
      else if (state.step === 'confirm_cancel') {
        if (message === 'si' || message === 'sí') {
          const result = await db.updateAppointmentStatus(state.appointmentId, 'cancelada');
          
          if (result.success) {
            delete userStates[from];
            twiml.message('Tu cita ha sido cancelada exitosamente.');
          } else {
            twiml.message('Error al cancelar la cita. Por favor intenta más tarde.');
          }
        } else {
          delete userStates[from];
          twiml.message('Cancelación cancelada. Tu cita sigue activa.');
        }
      }
      
      // SELECCIONAR CITA PARA CANCELAR
      else if (state.step === 'select_cancel') {
        const index = parseInt(message) - 1;
        
        if (isNaN(index) || index < 0 || index >= state.appointments.length) {
          twiml.message('Número inválido. Por favor responde con el número de la cita:');
          return;
        }
        
        const appointment = state.appointments[index];
        userStates[from] = { step: 'confirm_cancel', appointmentId: appointment.id };
        
        twiml.message(`¿Seguro que quieres cancelar esta cita?

Servicio: ${appointment.service_type}
Fecha: ${appointment.fecha_formateada}
Hora: ${appointment.hora_formateada}

Responde "SI" para confirmar o "NO" para mantenerla.`);
      }
      
      // CAMBIAR FECHA/HORA
      else if (state.step === 'ask_new_date') {
        if (message === 'fecha') {
          userStates[from] = {
            ...state,
            step: 'change_date_only'
          };
          twiml.message('¿Para qué nueva fecha? (Ej: 22/01)');
        } else if (message === 'hora') {
          userStates[from] = {
            ...state,
            step: 'change_time_only'
          };
          
          const availableSlots = await db.getAvailableTimeSlots(state.currentAppointment.appointment_date);
          
          let timeOptions = 'Horarios disponibles:\n';
          availableSlots.forEach(slot => {
            timeOptions += `• ${slot}\n`;
          });
          
          twiml.message(`¿A qué nueva hora? (Ej: 15:00)

${timeOptions}

Escribe la hora que prefieras:`);
        } else if (message === 'ambas') {
          userStates[from] = {
            ...state,
            step: 'change_date_first'
          };
          twiml.message('Primero, ¿para qué nueva fecha? (Ej: 22/01)');
        } else {
          twiml.message('Por favor responde: FECHA, HORA o AMBAS');
        }
      }
      
      // CAMBIAR SOLO FECHA
      else if (state.step === 'change_date_only') {
        if (!isValidDate(message)) {
          twiml.message('Formato incorrecto. Usa DD/MM (ej: 22/01):');
          return;
        }
        
        const [day, month] = message.split('/');
        const currentYear = new Date().getFullYear();
        const newDate = `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        
        const availableSlots = await db.getAvailableTimeSlots(newDate);
        
        if (availableSlots.length === 0) {
          twiml.message(`La fecha ${message} está completamente ocupada. Elige otra fecha:`);
          return;
        }
        
        const result = await db.updateAppointmentDateTime(
          state.appointmentId,
          newDate,
          state.currentAppointment.appointment_time
        );
        
        if (result.success) {
          delete userStates[from];
          twiml.message(`Fecha actualizada exitosamente a ${message}.

Tu cita ahora es:
Fecha: ${message}
Hora: ${state.currentAppointment.hora_formateada}
Servicio: ${state.currentAppointment.service_type}`);
        } else {
          twiml.message('Error al actualizar la fecha. Por favor intenta más tarde.');
        }
      }
      
      // CAMBIAR SOLO HORA
      else if (state.step === 'change_time_only') {
        if (!isValidTime(message)) {
          twiml.message('Formato incorrecto. Usa HH:MM (ej: 15:00):');
          return;
        }
        
        const newTime = message.padStart(5, '0');
        
        const result = await db.updateAppointmentDateTime(
          state.appointmentId,
          state.currentAppointment.appointment_date,
          newTime
        );
        
        if (result.success) {
          delete userStates[from];
          twiml.message(`Hora actualizada exitosamente a ${message}.

Tu cita ahora es:
Fecha: ${state.currentAppointment.fecha_formateada}
Hora: ${message}
Servicio: ${state.currentAppointment.service_type}`);
        } else {
          twiml.message('Error al actualizar la hora. Por favor intenta más tarde.');
        }
      }
      
      // RESPUESTA POR DEFECTO
      else {
        delete userStates[from];
        twiml.message(`No entiendo tu mensaje. 

Escribe "AGENDAR" para reservar cita
Escribe "CANCELAR" para cancelar
Escribe "AYUDA" para ver opciones`);
      }
    }
    
    // RESPUESTA POR DEFECTO
    else {
      twiml.message(`No entiendo tu mensaje. 

Escribe "HOLA" para comenzar
Escribe "AGENDAR" para reservar cita
Escribe "SERVICIOS" para ver servicios
Escribe "AYUDA" para ver todas las opciones`);
    }
    
    res.type('text/xml').send(twiml.toString());
    
  } catch (error) {
    console.error('ERROR en webhook:', error);
    const twilio = require('twilio');
    const MessagingResponse = twilio.twiml.MessagingResponse;
    const twiml = new MessagingResponse();
    twiml.message('Lo sentimos, hay un problema técnico. Por favor, intenta más tarde.');
    res.type('text/xml').send(twiml.toString());
  }
});

// ==================== INICIAR SERVIDOR ====================
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 VICTORIA\'S BOT - SISTEMA 24/7 ACTIVADO');
  console.log('='.repeat(50));
  console.log(`🌐 URL: https://victorias-bot.onrender.com`);
  console.log(`📱 Webhook: https://victorias-bot.onrender.com/webhook`);
  console.log(`👑 Panel: https://victorias-bot.onrender.com/admin`);
  console.log(`🏥 Health: https://victorias-bot.onrender.com/health`);
  console.log(`📊 Status: https://victorias-bot.onrender.com/status`);
  console.log('='.repeat(50));
  console.log('✅ Sistema de ping 24/7 activado');
  console.log('🔄 Ping automático cada 4 minutos');
  console.log('📡 Uptime Robot configurado para ping externo');
  console.log('='.repeat(50) + '\n');
  
  // Iniciar sistema de ping después de 10 segundos
  setTimeout(startPingSystem, 10000);
});
