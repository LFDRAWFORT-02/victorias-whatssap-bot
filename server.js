require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar URL de PostgreSQL
process.env.DATABASE_URL = 'postgresql://victorias_admin:7TB4EZxUJz4uBM8y9cVfuIor6WjHo8ZD@dpg-d5c3u3f5r7bs73aouo60-a/victorias_db';

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Configuración de sesión
app.use(session({
  secret: 'victorias-secret-key-' + Date.now(),
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Middleware de autenticación
const requireAuth = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/admin/login');
  }
};

// ==================== RUTAS ====================

// Ruta HOME
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Victoria's Bot</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
        h1 { color: #4a5568; }
        .status { background: #e6fffa; padding: 20px; border-radius: 10px; margin: 20px 0; }
        .btn { display: inline-block; background: #4299e1; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 10px; font-weight: bold; }
        .btn:hover { background: #3182ce; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🤖 Victoria's WhatsApp Bot</h1>
        <div class="status">
          <h2>✅ SISTEMA OPERATIVO</h2>
          <p><strong>Bot WhatsApp:</strong> Funcionando</p>
          <p><strong>Base de datos:</strong> Conectada</p>
          <p><strong>Panel admin:</strong> Disponible</p>
        </div>
        <a href="/admin" class="btn">👑 Acceder al Panel</a>
        <a href="/admin/login" class="btn" style="background: #38a169;">🔐 Login Directo</a>
        <p style="margin-top: 30px; color: #718096;">
          Usuario: <strong>admin</strong> | Contraseña: <strong>admin123</strong>
        </p>
      </div>
    </body>
    </html>
  `);
});

// ==================== PANEL ADMIN SIMPLIFICADO ====================
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
          <h1>📊 Panel Victoria's</h1>
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
        
        <h2>📋 Citas Agendadas</h2>
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
                    <button class="btn btn-success" onclick="updateStatus(${cita.id}, 'completada')">✅ Completar</button>
                    <button class="btn btn-danger" onclick="updateStatus(${cita.id}, 'cancelada')">❌ Cancelar</button>
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
                  alert('✅ Estado actualizado');
                  location.reload();
                }
              } catch (error) {
                alert('❌ Error actualizando');
              }
            }
          }
          
          // Actualizar cada 30 segundos
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
        <h2>🔐 Panel Victoria's</h2>
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

// ==================== WEBHOOK WHATSAPP ====================
app.post('/webhook', async (req, res) => {
  const twilio = require('twilio');
  const MessagingResponse = twilio.twiml.MessagingResponse;
  const twiml = new MessagingResponse();
  
  const message = req.body.Body.toLowerCase().trim();
  const from = req.body.From.replace('whatsapp:', '');
  
  if (message.includes('agendar')) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const appointmentData = {
      whatsapp_number: from,
      customer_name: 'Cliente WhatsApp',
      service_type: 'Servicio General',
      appointment_date: tomorrow.toISOString().split('T')[0],
      appointment_time: '14:00',
      price: 450
    };
    
    const result = await db.saveAppointment(appointmentData);
    
    if (result.success) {
      twiml.message(`✅ Cita agendada! ID: ${result.id}`);
    } else {
      twiml.message('❌ Error al agendar');
    }
  } else {
    twiml.message('¡Hola! Escribe "AGENDAR" para reservar una cita.');
  }
  
  res.type('text/xml').send(twiml.toString());
});

// ==================== INICIAR SERVIDOR ====================
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`🔐 Login: http://localhost:${PORT}/admin/login`);
});
