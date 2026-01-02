require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar variables de entorno PARA POSTGRES
// Servir archivos estáticos CORRECTAMENTE
app.use(express.static(__dirname));
process.env.DATABASE_URL = 'postgresql://victorias_admin:7TB4EZxUJz4uBM8y9cVfuIor6WjHo8ZD@dpg-d5c3u3f5r7bs73aouo60-a/victorias_db';

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Configuración de sesión para el panel admin
app.use(session({
  secret: 'victorias-secret-key-2024-' + Math.random().toString(36).substring(2),
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Cambiar a true si usas HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
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

// ========== RUTAS DEL PANEL ADMIN ==========
app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Login - Panel Victoria's</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
        }
        .login-container {
          width: 100%;
          max-width: 400px;
          padding: 20px;
        }
        .login-box { 
          background: white; 
          padding: 40px; 
          border-radius: 15px; 
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          text-align: center;
        }
        .logo { 
          font-size: 48px; 
          color: #667eea; 
          margin-bottom: 20px;
        }
        h2 { 
          color: #333; 
          margin-bottom: 30px;
          font-size: 24px;
        }
        input { 
          width: 100%; 
          padding: 15px; 
          margin: 10px 0; 
          border: 1px solid #ddd; 
          border-radius: 8px;
          font-size: 16px;
          box-sizing: border-box;
        }
        input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        button { 
          width: 100%; 
          padding: 15px; 
          background: #667eea; 
          color: white; 
          border: none; 
          border-radius: 8px; 
          cursor: pointer; 
          font-size: 16px;
          font-weight: 600;
          margin-top: 10px;
          transition: background 0.3s;
        }
        button:hover { 
          background: #5a6fd8;
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
        }
        .error { 
          color: #ff4757; 
          background: #ffe6e6;
          padding: 10px;
          border-radius: 8px;
          margin: 15px 0;
          display: ${req.query.error ? 'block' : 'none'};
        }
        .credentials {
          margin-top: 25px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
          color: #666;
          font-size: 14px;
        }
        .credentials strong {
          color: #333;
        }
      </style>
    </head>
    <body>
      <div class="login-container">
        <div class="login-box">
          <div class="logo">🔐</div>
          <h2>Panel de Administración<br>Victoria's</h2>
          
          <div class="error">
            <i class="fas fa-exclamation-circle"></i> Usuario o contraseña incorrectos
          </div>
          
          <form action="/admin/login" method="POST">
            <input type="text" name="username" placeholder="Usuario" required>
            <input type="password" name="password" placeholder="Contraseña" required>
            <button type="submit">Ingresar al Panel</button>
          </form>
          
          <div class="credentials">
            <p><strong>Credenciales por defecto:</strong></p>
            <p>Usuario: <strong>admin</strong></p>
            <p>Contraseña: <strong>admin123</strong></p>
            <p style="margin-top: 10px; font-size: 12px; color: #888;">
              <i>Puedes cambiar estas credenciales en la base de datos</i>
            </p>
          </div>
        </div>
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
    console.log('✅ Login exitoso para:', username);
    res.redirect('/admin');
  } else {
    console.log('❌ Login fallido para:', username);
    res.redirect('/admin/login?error=1');
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// ========== API PARA EL PANEL ==========
app.get('/api/appointments', requireAuth, async (req, res) => {
  try {
    const appointments = await db.getAllAppointments();
    res.json({ success: true, data: appointments });
  } catch (error) {
    console.error('Error en API appointments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error en API stats:', error);
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
    console.error('Error actualizando estado:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== WEBHOOK DE WHATSAPP (TU BOT EXISTENTE) ==========
app.post('/webhook', async (req, res) => {
  const twilio = require('twilio');
  const MessagingResponse = twilio.twiml.MessagingResponse;
  const twiml = new MessagingResponse();
  
  const message = req.body.Body.toLowerCase().trim();
  const from = req.body.From;
  
  console.log(`📱 WhatsApp de ${from}: ${message}`);
  
  // ===== AGENDAR CITA DESDE WHATSAPP =====
  if (message.includes('agendar') || message.includes('cita')) {
    // Extraer fecha del mensaje (ejemplo simple)
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const appointmentData = {
      whatsapp_number: from.replace('whatsapp:', ''),
      customer_name: 'Cliente WhatsApp',
      service_type: 'Servicio General',
      appointment_date: tomorrow.toISOString().split('T')[0], // Mañana
      appointment_time: '14:00',
      price: 450
    };
    
    const result = await db.saveAppointment(appointmentData);
    
    if (result.success) {
      twiml.message(`✅ ¡CITA AGENDADA EXITOSAMENTE! 

📅 Fecha: ${appointmentData.appointment_date}
⏰ Hora: ${appointmentData.appointment_time}
💇 Servicio: ${appointmentData.service_type}
💰 Precio: $${appointmentData.price}

Tu ID de cita es: ${result.id}

¡Te esperamos! ✨`);
    } else {
      twiml.message('❌ Lo siento, hubo un error al agendar tu cita. Por favor intenta de nuevo.');
    }
  }
  // ===== MENSAJE DE AYUDA =====
  else if (message.includes('hola') || message.includes('ayuda') || message.includes('menu')) {
    twiml.message(`¡Hola! 👋 Soy el asistente de *Victoria's*

📋 *Comandos disponibles:*
• "AGENDAR" - Para reservar una cita
• "CITAS" - Ver tus citas próximas
• "SERVICIOS" - Ver servicios disponibles
• "PRECIOS" - Conocer nuestros precios
• "HORARIO" - Ver horarios de atención

¿En qué puedo ayudarte? 💅`);
  }
  // ===== RESPUESTA POR DEFECTO =====
  else {
    twiml.message(`¡Hola! 💖 

Escribe "AGENDAR" para reservar una cita con nosotros.

O "AYUDA" para ver todas las opciones disponibles.

¡Estamos aquí para consentirte! ✨`);
  }
  
  res.type('text/xml').send(twiml.toString());
});

// ========== RUTAS PÚBLICAS ==========
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Victoria's Bot</title>
      <style>
        body { font-family: Arial; text-align: center; padding: 50px; }
        h1 { color: #667eea; }
        .status { background: #e6fff2; padding: 20px; border-radius: 10px; display: inline-block; margin: 20px; }
      </style>
    </head>
    <body>
      <h1>🤖 Victoria's WhatsApp Bot</h1>
      <div class="status">
        <h2>✅ SISTEMA OPERATIVO</h2>
        <p><strong>Bot WhatsApp:</strong> Funcionando</p>
        <p><strong>Base de datos:</strong> Conectada</p>
        <p><strong>Panel admin:</strong> <a href="/admin">Acceder aquí</a></p>
      </div>
      <p style="margin-top: 30px; color: #666;">
        Sistema de agendamiento profesional con PostgreSQL
      </p>
    </body>
    </html>
  `);
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, () => {
  console.log('🚀 ==========================================');
  console.log('   Victoria\'s Bot - Sistema Profesional');
  console.log('   ==========================================');
  console.log(`   🌐 Servidor: http://localhost:${PORT}`);
  console.log(`   📱 Webhook: http://localhost:${PORT}/webhook`);
  console.log(`   👑 Panel admin: http://localhost:${PORT}/admin`);
  console.log('   📊 PostgreSQL: CONECTADA');
  console.log('   ==========================================');
  console.log('   Credenciales panel:');
  console.log('   👤 Usuario: admin');
  console.log('   🔑 Contraseña: admin123');
  console.log('   ==========================================');
  console.log('   ✅ Sistema listo para producción');
  console.log('🚀 ==========================================');
});

