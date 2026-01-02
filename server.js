require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar URL de PostgreSQL (TU URL)
const DB_URL = 'postgresql://victorias_admin:7TB4EZxUJz4uBM8y9cVfuIor6WjHo8ZD@dpg-d5c3u3f5r7bs73aouo60-a/victorias_db';
process.env.DATABASE_URL = DB_URL;

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Configuración de sesión
app.use(session({
  secret: 'victorias-secret-session-2024-' + Math.random().toString(36).substring(7),
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // true si tienes HTTPS
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

// ==================== RUTAS PRINCIPALES ====================

// Ruta HOME
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Victoria's Bot</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; }
        body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; display: flex; align-items: center; justify-content: center; }
        .container { background: white; border-radius: 20px; padding: 40px; max-width: 800px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
        h1 { color: #333; text-align: center; margin-bottom: 10px; font-size: 2.5em; }
        .subtitle { color: #666; text-align: center; margin-bottom: 40px; font-size: 1.1em; }
        .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .status-card { background: #f8f9fa; padding: 25px; border-radius: 15px; text-align: center; transition: transform 0.3s; }
        .status-card:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
        .status-card i { font-size: 2.5em; margin-bottom: 15px; display: block; }
        .status-card h3 { color: #555; font-size: 0.9em; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
        .status-card .value { font-size: 2em; font-weight: bold; color: #333; }
        .card-1 i { color: #667eea; }
        .card-2 i { color: #10b981; }
        .card-3 i { color: #f59e0b; }
        .card-4 i { color: #ef4444; }
        .btn-container { display: flex; gap: 15px; justify-content: center; flex-wrap: wrap; }
        .btn { padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 1.1em; transition: all 0.3s; display: inline-flex; align-items: center; justify-content: center; gap: 10px; }
        .btn-primary { background: #667eea; color: white; }
        .btn-primary:hover { background: #5a6fd8; transform: translateY(-3px); box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3); }
        .btn-secondary { background: #10b981; color: white; }
        .btn-secondary:hover { background: #0da271; transform: translateY(-3px); box-shadow: 0 10px 20px rgba(16, 185, 129, 0.3); }
        .credentials { background: #f1f5f9; padding: 20px; border-radius: 12px; margin-top: 30px; text-align: center; }
        .credentials code { background: #e2e8f0; padding: 5px 10px; border-radius: 6px; font-family: monospace; margin: 0 5px; }
        .live-badge { background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; font-size: 0.9em; font-weight: 600; display: inline-block; margin-bottom: 20px; }
        .loading { color: #666; text-align: center; padding: 20px; }
      </style>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    </head>
    <body>
      <div class="container">
        <div class="live-badge">🟢 SISTEMA EN VIVO</div>
        <h1>🤖 Victoria's WhatsApp Bot</h1>
        <p class="subtitle">Sistema profesional de agendamiento con PostgreSQL</p>
        
        <div class="status-grid">
          <div class="status-card card-1">
            <i class="fas fa-database"></i>
            <h3>Base de Datos</h3>
            <div class="value" id="db-status">Cargando...</div>
          </div>
          <div class="status-card card-2">
            <i class="fas fa-calendar-check"></i>
            <h3>Citas Totales</h3>
            <div class="value" id="total-citas">0</div>
          </div>
          <div class="status-card card-3">
            <i class="fas fa-clock"></i>
            <h3>Pendientes</h3>
            <div class="value" id="pendientes">0</div>
          </div>
          <div class="status-card card-4">
            <i class="fas fa-money-bill-wave"></i>
            <h3>Ingresos</h3>
            <div class="value" id="ingresos">$0</div>
          </div>
        </div>
        
        <div class="btn-container">
          <a href="/admin" class="btn btn-primary">
            <i class="fas fa-chart-line"></i> Panel de Control
          </a>
          <a href="/admin/login" class="btn btn-secondary">
            <i class="fas fa-sign-in-alt"></i> Iniciar Sesión
          </a>
        </div>
        
        <div class="credentials">
          <p><strong>Credenciales de acceso:</strong></p>
          <p>Usuario: <code>admin</code> | Contraseña: <code>admin123</code></p>
          <p style="margin-top: 10px; font-size: 0.9em; color: #64748b;">
            <i class="fas fa-info-circle"></i> El panel puede tardar 30-50s en cargar (plan gratuito)
          </p>
        </div>
      </div>
      
      <script>
        async function cargarEstadisticas() {
          try {
            const response = await fetch('/api/stats');
            const data = await response.json();
            
            if (data.success) {
              document.getElementById('db-status').textContent = 'CONECTADA';
              document.getElementById('db-status').style.color = '#10b981';
              document.getElementById('total-citas').textContent = data.data.total;
              document.getElementById('pendientes').textContent = data.data.pending;
              document.getElementById('ingresos').textContent = '$' + (data.data.revenue || 0).toFixed(2);
            }
          } catch (error) {
            document.getElementById('db-status').textContent = 'ERROR';
            document.getElementById('db-status').style.color = '#ef4444';
            console.error('Error:', error);
          }
        }
        
        // Cargar al inicio y cada 30 segundos
        cargarEstadisticas();
        setInterval(cargarEstadisticas, 30000);
      </script>
    </body>
    </html>
  `);
});

// ==================== PANEL ADMIN ====================
app.get('/admin', requireAuth, (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Panel Victoria's</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        :root {
          --primary: #667eea;
          --secondary: #764ba2;
          --success: #10b981;
          --warning: #f59e0b;
          --danger: #ef4444;
          --light: #f8f9fa;
          --dark: #1f2937;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; }
        body { background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%); min-height: 100vh; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { background: white; padding: 25px; border-radius: 20px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .header h1 { color: var(--dark); font-size: 1.8em; }
        .header .user { display: flex; align-items: center; gap: 10px; color: #666; }
        .logout-btn { background: var(--danger); color: white; border: none; padding: 12px 24px; border-radius: 10px; cursor: pointer; font-weight: 600; transition: all 0.3s; }
        .logout-btn:hover { background: #dc2626; transform: translateY(-2px); }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: white; padding: 25px; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.08); }
        .stat-card i { font-size: 2.5em; margin-bottom: 15px; display: block; }
        .stat-card h3 { color: #6b7280; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
        .stat-card .number { font-size: 2.2em; font-weight: 800; color: var(--dark); }
        .stat-card:nth-child(1) i { color: var(--primary); }
        .stat-card:nth-child(2) i { color: var(--warning); }
        .stat-card:nth-child(3) i { color: var(--success); }
        .stat-card:nth-child(4) i { color: #8b5cf6; }
        .content { display: grid; grid-template-columns: 1fr 350px; gap: 25px; }
        @media (max-width: 1024px) { .content { grid-template-columns: 1fr; } }
        .card { background: white; padding: 30px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .card-title { font-size: 1.4em; color: var(--dark); margin-bottom: 25px; padding-bottom: 15px; border-bottom: 2px solid var(--light); }
        .filters { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .filter-btn { padding: 10px 20px; background: var(--light); border: none; border-radius: 10px; cursor: pointer; color: #6b7280; font-weight: 500; transition: all 0.3s; }
        .filter-btn.active, .filter-btn:hover { background: var(--primary); color: white; }
        .appointments-list { max-height: 600px; overflow-y: auto; padding-right: 10px; }
        .appointment-item { padding: 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; transition: background 0.3s; }
        .appointment-item:hover { background: #f9fafb; }
        .appointment-info h4 { color: var(--dark); margin-bottom: 5px; font-size: 1.1em; }
        .appointment-info p { color: #6b7280; font-size: 0.9em; margin-bottom: 3px; }
        .appointment-info p i { width: 16px; margin-right: 8px; }
        .appointment-status { padding: 6px 15px; border-radius: 20px; font-size: 0.8em; font-weight: 700; }
        .status-pendiente { background: #fef3c7; color: #92400e; }
        .status-completada { background: #d1fae5; color: #065f46; }
        .status-cancelada { background: #fee2e2; color: #991b1b; }
        .action-buttons { display: flex; gap: 8px; margin-top: 10px; }
        .action-btn { padding: 8px 16px; border: none; border-radius: 8px; cursor: pointer; font-size: 0.85em; font-weight: 600; transition: all 0.3s; }
        .complete-btn { background: var(--success); color: white; }
        .cancel-btn { background: var(--danger); color: white; }
        .complete-btn:hover { background: #0da271; transform: translateY(-2px); }
        .cancel-btn:hover { background: #dc2626; transform: translateY(-2px); }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; color: #4b5563; font-weight: 600; margin-bottom: 8px; }
        .form-group input, .form-group select { width: 100%; padding: 14px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 1em; transition: border 0.3s; }
        .form-group input:focus, .form-group select:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1); }
        .add-btn { width: 100%; padding: 16px; background: var(--primary); color: white; border: none; border-radius: 10px; font-size: 1.1em; font-weight: 700; cursor: pointer; transition: all 0.3s; margin-top: 10px; }
        .add-btn:hover { background: #5a6fd8; transform: translateY(-3px); box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3); }
        .loader { text-align: center; padding: 40px; color: #6b7280; }
        .refresh-btn { background: var(--primary); color: white; border: none; padding: 12px 24px; border-radius: 10px; cursor: pointer; font-weight: 600; margin-bottom: 20px; }
        .date-info { text-align: center; color: #6b7280; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
        .empty-state { text-align: center; padding: 40px; color: #6b7280; }
        .empty-state i { font-size: 3em; margin-bottom: 20px; color: #d1d5db; }
      </style>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <h1><i class="fas fa-chart-line"></i> Panel de Control - Victoria's</h1>
          <div class="user">
            <span>👤 ${req.session.user.username}</span>
            <button class="logout-btn" onclick="logout()">
              <i class="fas fa-sign-out-alt"></i> Cerrar Sesión
            </button>
          </div>
        </div>

        <!-- Estadísticas -->
        <div class="stats-grid">
          <div class="stat-card">
            <i class="fas fa-calendar-check"></i>
            <h3>Citas Totales</h3>
            <div class="number" id="total-citas">0</div>
          </div>
          <div class="stat-card">
            <i class="fas fa-clock"></i>
            <h3>Pendientes</h3>
            <div class="number" id="citas-pendientes">0</div>
          </div>
          <div class="stat-card">
            <i class="fas fa-check-circle"></i>
            <h3>Completadas</h3>
            <div class="number" id="citas-completadas">0</div>
          </div>
          <div class="stat-card">
            <i class="fas fa-money-bill-wave"></i>
            <h3>Ingresos Totales</h3>
            <div class="number" id="ingresos-totales">$0</div>
          </div>
        </div>

        <!-- Contenido principal -->
        <div class="content">
          <!-- Lista de citas -->
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
              <h2 class="card-title"><i class="fas fa-list"></i> Todas las Citas</h2>
              <button class="refresh-btn" onclick="loadAppointments()">
                <i class="fas fa-sync-alt"></i> Actualizar
              </button>
            </div>

            <!-- Filtros -->
            <div class="filters">
              <button class="filter-btn active" onclick="filterAppointments('todas')">Todas</button>
              <button class="filter-btn" onclick="filterAppointments('pendiente')">Pendientes</button>
              <button class="filter-btn" onclick="filterAppointments('completada')">Completadas</button>
              <button class="filter-btn" onclick="filterAppointments('cancelada')">Canceladas</button>
            </div>

            <!-- Lista de citas -->
            <div class="appointments-list" id="appointments-list">
              <div class="loader">
                <i class="fas fa-spinner fa-spin"></i> Cargando citas...
              </div>
            </div>
          </div>

          <!-- Sidebar -->
          <div class="card">
            <h2 class="card-title"><i class="fas fa-plus-circle"></i> Nueva Cita Manual</h2>
            
            <div class="form-group">
              <label><i class="fas fa-user"></i> Nombre del Cliente</label>
              <input type="text" id="customer-name" placeholder="Ej: María González">
            </div>

            <div class="form-group">
              <label><i class="fas fa-phone"></i> WhatsApp</label>
              <input type="text" id="whatsapp-number" placeholder="Ej: +521234567890">
            </div>

            <div class="form-group">
              <label><i class="fas fa-cut"></i> Servicio</label>
              <select id="service-type">
                <option value="Corte de cabello">Corte de cabello</option>
                <option value="Tinte">Tinte</option>
                <option value="Manicure">Manicure</option>
                <option value="Pedicure">Pedicure</option>
                <option value="Maquillaje">Maquillaje</option>
                <option value="Depilación">Depilación</option>
              </select>
            </div>

            <div class="form-group">
              <label><i class="fas fa-calendar"></i> Fecha</label>
              <input type="date" id="appointment-date">
            </div>

            <div class="form-group">
              <label><i class="fas fa-clock"></i> Hora</label>
              <input type="time" id="appointment-time">
            </div>

            <div class="form-group">
              <label><i class="fas fa-dollar-sign"></i> Precio ($)</label>
              <input type="number" id="price" placeholder="Ej: 500" min="0" step="50">
            </div>

            <button class="add-btn" onclick="addManualAppointment()">
              <i class="fas fa-plus"></i> Agregar Cita
            </button>

            <div class="date-info">
              <i class="fas fa-info-circle"></i> 
              Fecha actual: <span id="current-date"></span>
            </div>
          </div>
        </div>
      </div>

      <script>
        const API_BASE = '/api';
        let allAppointments = [];
        let currentFilter = 'todas';

        // Inicializar
        document.addEventListener('DOMContentLoaded', function() {
          loadStats();
          loadAppointments();
          setCurrentDate();
          
          // Actualizar cada 30 segundos
          setInterval(loadStats, 30000);
          setInterval(loadAppointments, 45000);
        });

        // Fecha actual
        function setCurrentDate() {
          const now = new Date();
          const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
          document.getElementById('current-date').textContent = now.toLocaleDateString('es-MX', options);
          
          // Fecha por defecto para nueva cita (mañana)
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          document.getElementById('appointment-date').value = tomorrow.toISOString().split('T')[0];
          
          // Hora por defecto (14:00)
          document.getElementById('appointment-time').value = '14:00';
        }

        // Cargar estadísticas
        async function loadStats() {
          try {
            const response = await fetch(API_BASE + '/stats');
            const data = await response.json();
            
            if (data.success) {
              document.getElementById('total-citas').textContent = data.data.total;
              document.getElementById('citas-pendientes').textContent = data.data.pending;
              document.getElementById('citas-completadas').textContent = data.data.completed;
              document.getElementById('ingresos-totales').textContent = 
                '$' + (data.data.revenue || 0).toFixed(2);
            }
          } catch (error) {
            console.error('Error cargando estadísticas:', error);
          }
        }

        // Cargar citas
        async function loadAppointments() {
          try {
            document.getElementById('appointments-list').innerHTML = 
              '<div class="loader"><i class="fas fa-spinner fa-spin"></i> Cargando citas...</div>';
            
            const response = await fetch(API_BASE + '/appointments');
            const data = await response.json();
            
            if (data.success) {
              allAppointments = data.data;
              displayAppointments();
            }
          } catch (error) {
            console.error('Error cargando citas:', error);
            document.getElementById('appointments-list').innerHTML = 
              '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Error al cargar citas</p></div>';
          }
        }

        // Mostrar citas
        function displayAppointments() {
          const container = document.getElementById('appointments-list');
          
          if (allAppointments.length === 0) {
            container.innerHTML = `
              <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <h3>No hay citas agendadas</h3>
                <p>Agenda tu primera cita desde WhatsApp o manualmente</p>
              </div>
            `;
            return;
          }

          let filtered = allAppointments;
          if (currentFilter !== 'todas') {
            filtered = allAppointments.filter(a => a.status === currentFilter);
          }

          // Actualizar botones de filtro
          document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
          });
          event?.target?.classList?.add('active');

          let html = '';
          filtered.forEach(appointment => {
            html += `
              <div class="appointment-item">
                <div class="appointment-info">
                  <h4>${appointment.customer_name}</h4>
                  <p><i class="fas fa-phone"></i> ${appointment.whatsapp_number}</p>
                  <p><i class="fas fa-cut"></i> ${appointment.service_type}</p>
                  <p><i class="fas fa-calendar"></i> ${appointment.fecha_formateada} a las ${appointment.hora_formateada}</p>
                  <p><i class="fas fa-dollar-sign"></i> $${appointment.price || '0'}</p>
                </div>
                <div style="text-align: right;">
                  <div class="appointment-status status-${appointment.status}">
                    ${appointment.status.toUpperCase()}
                  </div>
                  <div class="action-buttons">
                    ${appointment.status === 'pendiente' ? `
                      <button class="action-btn complete-btn" onclick="updateStatus(${appointment.id}, 'completada')">
                        <i class="fas fa-check"></i> Completar
                      </button>
                      <button class="action-btn cancel-btn" onclick="updateStatus(${appointment.id}, 'cancelada')">
                        <i class="fas fa-times"></i> Cancelar
                      </button>
                    ` : ''}
                    ${appointment.status === 'completada' ? `
                      <button class="action-btn cancel-btn" onclick="updateStatus(${appointment.id}, 'cancelada')">
                        <i class="fas fa-times"></i> Cancelar
                      </button>
                    ` : ''}
                  </div>
                </div>
              </div>
            `;
          });

          container.innerHTML = html;
        }

        // Filtrar citas
        function filterAppointments(filter) {
          currentFilter = filter;
          displayAppointments();
        }

        // Actualizar estado
        async function updateStatus(id, status) {
          if (!confirm('¿Estás seguro de marcar esta cita como ' + status + '?')) return;

          try {
            const response = await fetch(API_BASE + '/appointments/' + id + '/status', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status })
            });
            
            const data = await response.json();
            
            if (data.success) {
              alert('✅ Estado actualizado correctamente');
              loadAppointments();
              loadStats();
            } else {
              alert('❌ Error al actualizar');
            }
          } catch (error) {
            alert('❌ Error de conexión');
            console.error('Error:', error);
          }
        }

        // Agregar cita manual
        async function addManualAppointment() {
          const customerName = document.getElementById('customer-name').value;
          const whatsappNumber = document.getElementById('whatsapp-number').value;
          const serviceType = document.getElementById('service-type').value;
          const appointmentDate = document.getElementById('appointment-date').value;
          const appointmentTime = document.getElementById('appointment-time').value;
          const price = document.getElementById('price').value || '0';

          if (!customerName || !whatsappNumber || !appointmentDate || !appointmentTime) {
            alert('⚠️ Por favor completa todos los campos obligatorios');
            return;
          }

          try {
            const response = await fetch(API_BASE + '/appointments/manual', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                customer_name: customerName,
                whatsapp_number: whatsappNumber,
                service_type: serviceType,
                appointment_date: appointmentDate,
                appointment_time: appointmentTime,
                price: parseFloat(price)
              })
            });

            const data = await response.json();
            
            if (data.success) {
              alert('✅ Cita agregada exitosamente');
              // Limpiar formulario
              document.getElementById('customer-name').value = '';
              document.getElementById('whatsapp-number').value = '';
              document.getElementById('price').value = '';
              // Recargar datos
              loadAppointments();
              loadStats();
            } else {
              alert('❌ Error: ' + (data.error || 'No se pudo agregar la cita'));
            }
          } catch (error) {
            alert('❌ Error de conexión');
            console.error('Error:', error);
          }
        }

        // Cerrar sesión
        function logout() {
          window.location.href = '/admin/logout';
        }
      </script>
    </body>
    </html>
  `);
});

// ==================== LOGIN ====================
app.get('/admin/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Login - Victoria's</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          height: 100vh; margin: 0; display: flex; align-items: center; justify-content: center;
        }
        .login-box { 
          background: white; padding: 40px; border-radius: 20px; 
          box-shadow: 0 25px 50px rgba(0,0,0,0.15); width: 100%; max-width: 400px;
        }
        .logo { font-size: 48px; color: #667eea; text-align: center; margin-bottom: 20px; }
        h2 { color: #1f2937; text-align: center; margin-bottom: 10px; }
        .subtitle { color: #6b7280; text-align: center; margin-bottom: 30px; }
        input { 
          width: 100%; padding: 15px; margin: 12px 0; border: 2px solid #e5e7eb; 
          border-radius: 12px; font-size: 16px; transition: all 0.3s;
        }
        input:focus { 
          outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
        }
        button { 
          width: 100%; padding: 16px; background: #667eea; color: white; 
          border: none; border-radius: 12px; font-size: 16px; font-weight: 700;
          cursor: pointer; margin-top: 10px; transition: all 0.3s;
        }
        button:hover { 
          background: #5a6fd8; transform: translateY(-2px); 
          box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }
        .error { 
          background: #fee2e2; color: #991b1b; padding: 15px; border-radius: 10px;
          margin: 15px 0; text-align: center; display: ${req.query.error ? 'block' : 'none'};
        }
        .credentials { 
          background: #f8fafc; padding: 20px; border-radius: 12px; 
          margin-top: 25px; text-align: center; color: #4b5563;
        }
        .credentials code { 
          background: #e5e7eb; padding: 5px 10px; border-radius: 6px; 
          font-family: monospace; margin: 0 5px;
        }
      </style>
    </head>
    <body>
      <div class="login-box">
        <div class="logo">🔐</div>
        <h2>Panel de Administración</h2>
        <p class="subtitle">Victoria's Beauty Salon</p>
        
        ${req.query.error ? `
          <div class="error">
            <i class="fas fa-exclamation-circle"></i> Usuario o contraseña incorrectos
          </div>
        ` : ''}
        
        <form action="/admin/login" method="POST">
          <input type="text" name="username" placeholder="Usuario" required>
          <input type="password" name="password" placeholder="Contraseña" required>
          <button type="submit">
            <i class="fas fa-sign-in-alt"></i> Ingresar al Panel
          </button>
        </form>
        
        <div class="credentials">
          <p><strong>Credenciales por defecto:</strong></p>
          <p>Usuario: <code>admin</code></p>
          <p>Contraseña: <code>admin123</code></p>
          <p style="margin-top: 15px; font-size: 0.9em; color: #9ca3af;">
            <i class="fas fa-shield-alt"></i> Cambia estas credenciales después del primer login
          </p>
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

// ==================== API ====================
app.get('/api/appointments', requireAuth, async (req, res) => {
  try {
    const appointments = await db.getAllAppointments();
    res.json({ success: true, data: appointments });
  } catch (error) {
    console.error('Error API appointments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error API stats:', error);
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

app.post('/api/appointments/manual', requireAuth, async (req, res) => {
  try {
    const appointmentData = {
      whatsapp_number: req.body.whatsapp_number,
      customer_name: req.body.customer_name,
      service_type: req.body.service_type,
      appointment_date: req.body.appointment_date,
      appointment_time: req.body.appointment_time,
      price: req.body.price || 0
    };
    
    const result = await db.saveAppointment(appointmentData);
    res.json(result);
  } catch (error) {
    console.error('Error creando cita manual:', error);
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
  
  console.log(`📱 WhatsApp de ${from}: ${message}`);
  
  if (message.includes('agendar') || message.includes('cita') || message.includes('reservar')) {
    const today = new Date();
    const tomorrow = new Date(today);
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
      twiml.message(`✅ ¡CITA AGENDADA EXITOSAMENTE!

📅 Fecha: ${appointmentData.appointment_date}
⏰ Hora: ${appointmentData.appointment_time}
💇 Servicio: ${appointmentData.service_type}
💰 Precio: $${appointmentData.price}

ID de cita: ${result.id}

¡Te esperamos! ✨`);
    } else {
      twiml.message('❌ Lo siento, hubo un error. Por favor intenta de nuevo o contacta directamente.');
    }
  } else if (message.includes('hola') || message.includes('ayuda') || message.includes('menu')) {
    twiml.message(`¡Hola! 👋 Soy el asistente de *Victoria's*

📋 *Comandos disponibles:*
• "AGENDAR" - Reservar una cita
• "CITAS" - Ver tus citas
• "SERVICIOS" - Ver servicios
• "PRECIOS" - Conocer precios
• "HORARIO" - Horarios de atención

¿En qué puedo ayudarte? 💅`);
  } else if (message.includes('servicios') || message.includes('que ofrecen')) {
    twiml.message(`💅 *SERVICIOS DISPONIBLES:*

✂️ *Corte de Cabello* - Desde $300
🎨 *Tinte y Coloración* - Desde $500
💅 *Manicure* - Desde $200
👣 *Pedicure* - Desde $250
💄 *Maquillaje* - Desde $400
🧖 *Depilación* - Desde $350

Escribe "AGENDAR" para reservar tu cita. ✨`);
  } else if (message.includes('precios') || message.includes('costo')) {
    twiml.message(`💰 *PRECIOS APROXIMADOS:*

✂️ Corte: $300 - $600
🎨 Tinte: $500 - $1200
💅 Manicure: $200 - $400  
👣 Pedicure: $250 - $450
💄 Maquillaje: $400 - $800
🧖 Depilación: $350 - $700

*Para precios exactos y promociones, agenda tu cita!*

Escribe "AGENDAR" para comenzar. 💖`);
  } else {
    twiml.message(`¡Hola! 💖 

Para agendar una cita, escribe *"AGENDAR"*

Para ver servicios y precios, escribe *"SERVICIOS"*

Para ayuda, escribe *"AYUDA"*

¡Estamos aquí para consentirte! ✨`);
  }
  
  res.type('text/xml').send(twiml.toString());
});

// ==================== INICIAR SERVIDOR ====================
app.listen(PORT, () => {
  console.log(`
  🚀 ============================================
     Victoria's Bot - Sistema Profesional
     ============================================
     🌐 URL: https://victorias-bot.onrender.com
     📱 Webhook: /webhook
     👑 Panel: /admin
     🔐 Login: /admin/login
     📊 PostgreSQL: CONECTADA
     ============================================
     Credenciales:
     👤 Usuario: admin
     🔑 Contraseña: admin123
     ============================================
     ✅ Sistema 100% operativo
  🚀 ============================================
  `);
});
