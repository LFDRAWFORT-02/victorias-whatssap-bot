// 📦 PAQUETES QUE NECESITAMOS
const express = require('express');
const { MessagingResponse } = require('twilio').twiml;

// 🏗️ CONSTRUIR EL SERVIDOR
const app = express();
app.use(express.urlencoded({ extended: true }));

// 📒 CUADERNO PARA RECORDAR
const cuaderno = {};

// ✨ SERVICIOS DE VICTORIAS HAIRSALON ✨
const servicios = [
  "1. 💇 CORTE",
  "   👩 Corte dama, caballero o niños - $100",
  "   ✂️ Fleco, barba o shampoo - $50",
  "   💇‍♀️ Bob - $350",
  "",
  "2. 🎨 EFECTOS DE COLOR Y TRATAMIENTOS",
  "   ✨ Depilación facial (por área) - $80",
  "   👁️ Planchado de ceja (con depilación) - $200",
  "   👁️‍🗨️ Rizado de pestañas - $200",
  "   💆‍♀️ Alaciado express - $250 a $450",
  "   🎨 Aplicación de tinte - $350",
  "   💃 Peinado - $450",
  "   💄 Maquillaje (con pestañas) - $500",
  "   👑 Peinado + Maquillaje casual - $950",
  "   🌈 Efecto de color - Desde $1050",
  "",
  "3. 💅 UÑAS",
  "   ✨ Manicure (gel, un tono) - $220",
  "   💅 Gelish - $150",
  "   👣 Pedicure (gel, un tono) - $320",
  "   💎 Uñas esculturales - Desde $250",
  "   💪 Rubber - $200",
  "",
  "4. 💆‍♀️ OTROS SERVICIOS",
  "   💖 Keratina (por onza) - $950",
  "   💆‍♀️ Botox (aplicación) - $900",
  "   ✨ Limpieza facial - $450"
];

// 🎪 MENÚ PRINCIPAL
const menu = `✨ *VICTORIAS HAIRSALON* 💇‍♀️

¡Hola! Soy tu asistente virtual.
Escribe el número de lo que quieres:

1️⃣ Ver todos los servicios y precios
2️⃣ Agendar una cita  
3️⃣ Ver mi cita agendada
4️⃣ Información de contacto y horarios

¿Qué te gustaría hacer?`;

// ✅ RUTA DE PRUEBA EN LA RAÍZ
app.get('/', (req, res) => {
  console.log("✅ GET a la raíz recibido");
  res.send('✅ Bot Victorias Hairsalon funcionando. Webhook: POST /whatsapp-webhook');
});

// ✅ RUTA DE PRUEBA POST EN RAÍZ (por si Twilio envía aquí)
app.post('/', (req, res) => {
  console.log("✅ POST a la raíz recibido, redirigiendo a /whatsapp-webhook");
  // Redirigir al webhook correcto
  res.redirect(307, '/whatsapp-webhook');
});

// 📞 CUANDO ALGUIEN ESCRIBE POR WHATSAPP
app.post('/whatsapp-webhook', (req, res) => {
  console.log("📱 Webhook /whatsapp-webhook llamado!");
  
  // SI NO HAY DATOS DE TWILIO, RESPONDER CON ÉXITO
  if (!req.body || !req.body.From) {
    console.log("⚠️ No hay datos de Twilio, respondiendo 200 OK");
    const respuesta = new MessagingResponse();
    res.type('text/xml');
    res.send(respuesta.toString());
    return;
  }
  
  console.log("📱 Mensaje recibido de Twilio!");
  
  // Crear respuesta para Twilio
  const respuesta = new MessagingResponse();
  const mensaje = respuesta.message();
  
  // Datos del mensaje (AHORA SEGURO QUE EXISTEN)
  const telefono = req.body.From;
  const texto = (req.body.Body || '').trim().toLowerCase();
  
  console.log(`De: ${telefono}`);
  console.log(`Dice: ${texto}`);
  
  // 🎯 LÓGICA DEL BOT
  
  // Si es la primera vez o dice "hola"
  if (!cuaderno[telefono] || texto === 'hola') {
    cuaderno[telefono] = {
      paso: 'menu',
      cita: {}
    };
    mensaje.body(menu);
  }
  
  // Obtener datos de esta persona
  const datos = cuaderno[telefono];
  
  // 📋 MENÚ PRINCIPAL
  if (datos.paso === 'menu') {
    if (texto === '1') {
      // Mostrar servicios
      let lista = "💖 *NUESTROS SERVICIOS Y PRECIOS:*\n\n";
      servicios.forEach(servicio => {
        lista += servicio + "\n";
      });
      lista += "\n💝 *HORARIO:* Lunes a sábado de 10am a 8pm";
      lista += "\n\n✨ Para agendar, escribe '2'";
      mensaje.body(lista);
    }
    else if (texto === '2') {
      // Empezar a agendar - versión simplificada
      datos.paso = 'elegir_categoria';
      mensaje.body("💇 *¿QUÉ SERVICIO DESEAS?*\n\nEscribe el número:\n\n1. Corte\n2. Efectos de color/Tratamientos\n3. Uñas\n4. Otros servicios\n\nO escribe el nombre exacto del servicio.");
    }
    else if (texto === '3') {
      // Ver cita guardada
      if (datos.cita && datos.cita.servicio) {
        mensaje.body(`📅 *TU CITA AGENDADA:*\n\n✨ Servicio: ${datos.cita.servicio}\n📅 Fecha: ${datos.cita.fecha}\n⏰ Hora: ${datos.cita.hora}\n\n📍 *VICTORIAS HAIRSALON*\nPlaza Laguna Local 35\nDr. Alfredo Gochicoa 1020\nCol. Volantín, Tampico, Tam.`);
      } else {
        mensaje.body("📭 Aún no tienes citas agendadas.\nEscribe '2' para agendar una cita.");
      }
    }
    else if (texto === '4') {
      mensaje.body(`📍 *INFORMACIÓN DE CONTACTO*\n\n🏢 *VICTORIAS HAIRSALON*\nPlaza Laguna Local 35\nDr. Alfredo Gochicoa 1020\nCol. Volantín, Tampico, Tam.\n\n⏰ *HORARIO:*\nLunes a sábado de 10am a 8pm\n\n📞 *RESERVACIONES POR WHATSAPP*\n(Escribe '2' para agendar cita)\n\n✨ ¡Te esperamos!`);
    }
    else {
      mensaje.body(menu);
    }
  }
  
  // 🛒 ELEGIR CATEGORÍA
  else if (datos.paso === 'elegir_categoria') {
    if (['1','2','3','4'].includes(texto)) {
      const categorias = [
        "Corte",
        "Efectos de color y tratamientos", 
        "Uñas",
        "Otros servicios"
      ];
      datos.cita.categoria = categorias[parseInt(texto) - 1];
      datos.paso = 'elegir_fecha';
      mensaje.body(`✅ Categoría: *${datos.cita.categoria}*\n\n📅 *¿PARA QUÉ FECHA DESEAS TU CITA?*\n(Ejemplo: 15/enero/2025 o mañana, viernes, etc.)`);
    } else {
      // Si escribe nombre directo del servicio
      datos.cita.servicio = texto;
      datos.paso = 'elegir_fecha';
      mensaje.body(`✅ Servicio: *${texto}*\n\n📅 *¿PARA QUÉ FECHA DESEAS TU CITA?*\n(Ejemplo: 15/enero/2025)`);
    }
  }
  
  // 📅 ELEGIR FECHA
  else if (datos.paso === 'elegir_fecha') {
    datos.cita.fecha = texto;
    datos.paso = 'elegir_hora';
    
    let horaMsg = `📅 Fecha: *${texto}*\n\n⏰ *¿A QUÉ HORA PREFIERES?*\n\nHorario disponible:\n`;
    horaMsg += "• 10:00 AM\n• 11:00 AM\n• 12:00 PM\n• 1:00 PM\n• 2:00 PM\n";
    horaMsg += "• 3:00 PM\n• 4:00 PM\n• 5:00 PM\n• 6:00 PM\n• 7:00 PM\n\n";
    horaMsg += "Escribe la hora exacta (ejemplo: 3:00 PM)";
    
    mensaje.body(horaMsg);
  }
  
  // ⏰ ELEGIR HORA
  else if (datos.paso === 'elegir_hora') {
    datos.cita.hora = texto;
    datos.paso = 'confirmar';
    
    const resumen = `📋 *RESUMEN DE TU CITA:*\n\n` +
      `💇 ${datos.cita.servicio || datos.cita.categoria}\n` +
      `📅 Fecha: ${datos.cita.fecha}\n` +
      `⏰ Hora: ${datos.cita.hora}\n\n` +
      `📍 *VICTORIAS HAIRSALON*\n` +
      `Plaza Laguna Local 35\n` +
      `Dr. Alfredo Gochicoa 1020\n` +
      `Col. Volantín, Tampico, Tam.\n\n` +
      `⏰ Horario: Lunes a sábado 10am-8pm\n\n` +
      `¿Está todo correcto?\n\n` +
      `Escribe: *SI* ✅ para confirmar\n` +
      `Escribe: *NO* ❌ para cancelar`;
    
    mensaje.body(resumen);
  }
  
  // ✅ CONFIRMAR O CANCELAR
  else if (datos.paso === 'confirmar') {
    if (texto === 'si') {
      mensaje.body(`🎉 *¡CITA CONFIRMADA!* 🎉\n\n` +
        `✨ *VICTORIAS HAIRSALON*\n\n` +
        `📅 *DETALLES DE TU CITA:*\n` +
        `Servicio: ${datos.cita.servicio || datos.cita.categoria}\n` +
        `Fecha: ${datos.cita.fecha}\n` +
        `Hora: ${datos.cita.hora}\n\n` +
        `📍 *DIRECCIÓN:*\n` +
        `Plaza Laguna Local 35\n` +
        `Dr. Alfredo Gochicoa 1020\n` +
        `Col. Volantín, Tampico, Tam.\n\n` +
        `⏰ *HORARIO:* Lunes a sábado 10am-8pm\n\n` +
        `💖 *RECOMENDACIONES:*\n` +
        `• Llegar 10 minutos antes\n` +
        `• Traer cubrebocas\n` +
        `• Cancelar con 24h de anticipación\n\n` +
        `✨ ¡Gracias por tu reserva!\n\n` +
        `Escribe 'hola' para volver al menú.`);
      datos.paso = 'menu';
    } else if (texto === 'no') {
      mensaje.body("❌ *CITA CANCELADA*\n\nSi deseas agendar otra cita, escribe 'hola' para empezar de nuevo.\n\n✨ ¡Te esperamos pronto!");
      datos.paso = 'menu';
      datos.cita = {};
    } else {
      mensaje.body("Por favor responde *SI* o *NO*");
    }
  }
  
  // 📤 ENVIAR RESPUESTA
  res.type('text/xml');
  res.send(respuesta.toString());
  console.log("✅ Respuesta enviada a Twilio!");
});

// 🚀 ENCENDER EL BOT
const puerto = 3000;
app.listen(puerto, () => {
  console.log("=".repeat(60));
  console.log("✨✨ VICTORIAS HAIRSALON BOT ACTIVO ✨✨");
  console.log(`📍 Dirección local: http://localhost:${puerto}`);
  console.log(`📍 Prueba GET: http://localhost:${puerto}/`);
  console.log(`🔗 Webhook: http://localhost:${puerto}/whatsapp-webhook`);
  console.log("=".repeat(60));
  console.log("\n✅ Bot MEJORADO con rutas adicionales");
});
