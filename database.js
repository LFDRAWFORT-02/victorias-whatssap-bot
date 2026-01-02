const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Configuración de la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Crear tablas si no existen
const createTables = async () => {
  try {
    // Tabla de citas
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

    // Tabla de administradores
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insertar admin por defecto si no existe
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
      console.log('✅ Admin por defecto creado: usuario=admin, contraseña=admin123');
    }

    console.log('✅ Tablas creadas correctamente en PostgreSQL');
  } catch (error) {
    console.error('❌ Error creando tablas:', error.message);
  }
};

// Inicializar tablas al iniciar (con retardo para esperar conexión)
setTimeout(() => {
  createTables();
}, 3000);

// Funciones para citas
const db = {
  // Guardar nueva cita DESDE EL BOT
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
      console.log('✅ Cita guardada en BD con ID:', result.rows[0].id);
      return { success: true, id: result.rows[0].id };
    } catch (error) {
      console.error('❌ Error guardando cita:', error.message);
      return { success: false, error: error.message };
    }
  },

  // Obtener todas las citas (PARA EL PANEL)
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

  // Obtener estadísticas (PARA EL DASHBOARD)
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

  // Actualizar estado de cita (COMPLETADA/CANCELADA)
  async updateAppointmentStatus(id, status) {
    try {
      await pool.query(
        'UPDATE citas SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [status, id]
      );
      console.log(`✅ Cita ${id} actualizada a: ${status}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error actualizando estado:', error.message);
      return { success: false, error: error.message };
    }
  },

  // Verificar login del panel admin
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
  }
};

module.exports = db;
