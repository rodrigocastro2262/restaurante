import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import { EventEmitter } from 'events';

const db = new Database('restaurante.db');
const events = new EventEmitter();

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS mesas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero INT,
      nombre VARCHAR(50),
      estado VARCHAR(22) DEFAULT 'disponible'
  );

  CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY,
      nombre VARCHAR(50)
  );

  CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY,
      categoria_id INT,
      nombre VARCHAR(100),
      precio REAL,
      disponible BOOLEAN DEFAULT 1,
      FOREIGN KEY (categoria_id) REFERENCES categorias(id)
  );

  CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesa_id INT,
      estado VARCHAR(20) DEFAULT 'abierto',
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      juego_minutos INT DEFAULT 0,
      juego_inicio DATETIME,
      juego_estado VARCHAR(20) DEFAULT 'activo',
      juego_restante_ms INTEGER DEFAULT 0,
      FOREIGN KEY (mesa_id) REFERENCES mesas(id)
  );

  CREATE TABLE IF NOT EXISTS pedido_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INT,
      producto_id INT,
      cantidad INT,
      estado VARCHAR(20) DEFAULT 'pendiente',
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
      FOREIGN KEY (producto_id) REFERENCES productos(id)
  );

  CREATE TABLE IF NOT EXISTS pagos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INT,
      metodo VARCHAR(50),
      monto REAL,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
  );

  CREATE TABLE IF NOT EXISTS gastos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      descripcion VARCHAR(255),
      categoria VARCHAR(50),
      monto REAL,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sabores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre VARCHAR(50),
      disponible BOOLEAN DEFAULT 1
  );
`);

try {
  db.exec("ALTER TABLE mesas ADD COLUMN nombre VARCHAR(50)");
} catch (e) {}

try {
  db.exec("ALTER TABLE pedidos ADD COLUMN juego_minutos INT DEFAULT 0");
  db.exec("ALTER TABLE pedidos ADD COLUMN juego_inicio DATETIME");
} catch (e) {}

try {
  db.exec("ALTER TABLE pedidos ADD COLUMN juego_estado VARCHAR(20) DEFAULT 'activo'");
  db.exec("ALTER TABLE pedidos ADD COLUMN juego_restante_ms INTEGER DEFAULT 0");
} catch (e) {}

try {
  db.exec("ALTER TABLE productos ADD COLUMN disponible BOOLEAN DEFAULT 1");
} catch (e) {}

try {
  db.exec("ALTER TABLE sabores ADD COLUMN tipo VARCHAR(50) DEFAULT 'helado'");
} catch (e) {}

try {
  db.exec("ALTER TABLE pedido_items ADD COLUMN notas VARCHAR(255)");
} catch (e) {}

try {
  db.exec("ALTER TABLE pedido_items ADD COLUMN pagado_cantidad INT DEFAULT 0");
} catch (e) {}

// Seed Data
const opciones = [
  { tipo: 'helado', nombre: 'Fresa' },
  { tipo: 'helado', nombre: '3 Leches' },
  { tipo: 'helado', nombre: 'Brownie' },
  { tipo: 'helado', nombre: 'Ron Pasas' },
  { tipo: 'helado', nombre: 'Veteado de Mora' },
  { tipo: 'helado', nombre: 'Capuchino' },
  { tipo: 'helado', nombre: 'Vainilla Chips' },
  { tipo: 'helado', nombre: 'Jumbo' },
  { tipo: 'helado', nombre: 'Chicle' },
  { tipo: 'helado', nombre: 'Yogur Maracuyá' },
  { tipo: 'helado', nombre: 'Nata Maní' },
  { tipo: 'helado', nombre: 'Maracuyá' },
  { tipo: 'jugo', nombre: 'Mora' },
  { tipo: 'jugo', nombre: 'Maracuyá' },
  { tipo: 'jugo', nombre: 'Guanábana' },
  { tipo: 'aromatica', nombre: 'Manzanilla' },
  { tipo: 'aromatica', nombre: 'Hierbabuena' }
];

const currentOpciones = db.prepare('SELECT nombre, tipo FROM sabores').all() as { nombre: string, tipo: string }[];
const currentKeys = currentOpciones.map(o => `${o.tipo}-${o.nombre}`);
const newKeys = opciones.map(o => `${o.tipo}-${o.nombre}`);

// Remove old flavors that are not in the new list
const toRemove = currentOpciones.filter(o => !newKeys.includes(`${o.tipo}-${o.nombre}`));
if (toRemove.length > 0) {
  const deleteStmt = db.prepare(`DELETE FROM sabores WHERE tipo = ? AND nombre = ?`);
  toRemove.forEach(o => deleteStmt.run(o.tipo, o.nombre));
}

// Add new flavors that are not in the current list
const toAdd = opciones.filter(o => !currentKeys.includes(`${o.tipo}-${o.nombre}`));
if (toAdd.length > 0) {
  const insertSabor = db.prepare('INSERT INTO sabores (nombre, tipo, disponible) VALUES (?, ?, 1)');
  toAdd.forEach(o => insertSabor.run(o.nombre, o.tipo));
}

const mesasCount = db.prepare('SELECT COUNT(*) as count FROM mesas').get() as { count: number };
if (mesasCount.count === 0) {
  const insertMesa = db.prepare('INSERT INTO mesas (numero, nombre) VALUES (?, ?)');
  insertMesa.run(1, 'Mesa A');
  for (let i = 2; i <= 19; i++) {
    insertMesa.run(i, `${i - 1}`);
  }
  insertMesa.run(20, 'Sala Roja');
  insertMesa.run(21, 'Sala Blanca');
  insertMesa.run(22, 'Sala Verde');
} else {
  // Update existing names
  db.exec("UPDATE mesas SET nombre = 'Mesa A' WHERE id = 1");
  for (let i = 2; i <= 19; i++) {
    db.exec(`UPDATE mesas SET nombre = '${i - 1}' WHERE id = ${i}`);
  }
  db.exec("UPDATE mesas SET nombre = 'Sala Roja' WHERE id = 20");
  
  const count21 = db.prepare("SELECT COUNT(*) as c FROM mesas WHERE id = 21").get() as any;
  if (count21.c === 0) db.exec("INSERT INTO mesas (id, numero, estado, nombre) VALUES (21, 21, 'disponible', 'Sala Blanca')");
  else db.exec("UPDATE mesas SET nombre = 'Sala Blanca' WHERE id = 21");

  const count22 = db.prepare("SELECT COUNT(*) as c FROM mesas WHERE id = 22").get() as any;
  if (count22.c === 0) db.exec("INSERT INTO mesas (id, numero, estado, nombre) VALUES (22, 22, 'disponible', 'Sala Verde')");
  else db.exec("UPDATE mesas SET nombre = 'Sala Verde' WHERE id = 22");
}

  const categoriasCount = db.prepare('SELECT COUNT(*) as count FROM categorias').get() as { count: number };
  if (categoriasCount.count === 0) {
    const insertCategoria = db.prepare('INSERT INTO categorias (id, nombre) VALUES (?, ?)');
    const categorias = [
      [1, 'Heladería'], [2, 'Comidas Rápidas'], [3, 'Bebidas Frías'],
      [4, 'Bebidas Calientes'], [5, 'Infantiles'], [6, 'Juegos']
    ];
    categorias.forEach(c => insertCategoria.run(c[0], c[1]));

    const insertProducto = db.prepare('INSERT INTO productos (id, categoria_id, nombre, precio) VALUES (?, ?, ?, ?)');
    const productos = [
      [1, 1, 'Cono de helado', 3500], [2, 1, 'cono 2 sabores', 6000], [3, 1, 'cono 3 sabores', 9000],
      [4, 1, 'canasta de helado', 6000], [5, 1, 'canasta 2 sabores', 8500], [6, 1, 'canasta 3 sabores', 11000],
      [7, 1, 'ensalada MAX', 17000], [8, 1, 'ensalada mini', 13000], [9, 1, 'ensalada MAX sin H', 15000],
      [10, 1, 'ensalada mini sin H', 11000], [11, 1, 'banana split', 13000], [12, 1, 'pasion chocolate', 13000],
      [13, 1, 'copa oreo', 13000], [14, 1, 'Copa sofi', 13000], [15, 1, 'Copa victoria', 13000],
      [16, 1, 'Fresas con crema', 13000], [17, 1, 'Brawnie con helado', 13000], [18, 1, 'Creps con Helado', 16000],
      [19, 1, 'Frutihelado', 16000], [20, 1, 'Copa sin Helado', 15000], [21, 1, 'Oblea ', 5000],
      [22, 1, 'picada de fruta', 11000], [23, 1, 'Adicional de Queso', 3000], [24, 1, 'Paleta de Agua', 2500],
      [25, 1, 'Paleta de Mongo B', 3000], [26, 1, 'Chococono', 4000], [27, 1, 'adicional de helado', 2500],
      [28, 2, 'Hamburguesa', 17000], [29, 2, 'hamburguesa con Papas', 20000], [30, 2, 'Hamburguesa MAX', 25000],
      [31, 2, 'Hamburguesa Max papas', 6000], [32, 2, 'Sandwche cubano', 8500], [33, 2, 'Sanduche cubano con papas', 11000],
      [34, 2, 'Creps de pollo', 17000], [35, 2, 'Creps de pollo con papas', 20000], [36, 2, 'Hamburguesa mini', 9000],
      [37, 2, 'Hamburguesa mini con papas', 12000], [38, 2, 'Sandwichs', 5000], [39, 2, 'Sancwichs de pollo', 7000],
      [40, 2, 'Porcion de papas', 6000], [41, 2, 'Adicional de Carne', 5000],
      [42, 3, 'Malteada', 7000], [43, 3, 'Granizado de Cafe', 7000], [44, 3, 'Milo friio', 7000],
      [45, 3, 'Tamarindo Escarcha', 7000], [46, 3, 'Soda Escarcha', 7000], [47, 3, 'Jugo en leche', 6000],
      [48, 1, 'Jugo en Agua', 5000], [49, 3, 'Hit Cajita', 2500], [50, 3, 'Hit Litro Caja', 7000],
      [51, 3, 'Agua Pequeña', 1500], [52, 3, 'Agua Grande', 1500], [53, 3, 'Gaseosa', 3000],
      [54, 4, 'Milo Caliente', 3500], [55, 4, 'Cafe', 1500], [56, 4, 'Aromatica', 1500],
      [57, 4, 'Pintadito', 2000], [58, 4, 'Aromatica Con Frutas', 7000],
      [59, 5, 'Araña', 7000], [60, 5, 'Gato', 7000], [61, 5, 'Raton', 7000],
      [62, 5, 'Elefante', 7000], [63, 5, 'Conejo', 7000], [64, 5, 'Gusano', 7000],
      [65, 5, 'Bonbon', 3000], [66, 5, 'Huevo Sorpresa', 5000],
      [67, 6, '15 minutos', 3000], [68, 6, '30 minutos', 5000], [69, 6, '60 minutos', 7000],
      [70, 6, 'ficha', 10000], [71, 6, '500', 500]
    ];
    productos.forEach(p => insertProducto.run(p[0], p[1], p[2], p[3]));
  }

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // SSE Endpoint for real-time updates
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const onUpdate = () => {
      res.write(`data: update\n\n`);
    };

    events.on('update', onUpdate);

    req.on('close', () => {
      events.off('update', onUpdate);
    });
  });

  // API Routes
  const draftOrders = new Map<number, any>();

  app.post('/api/pedidos/draft', (req, res) => {
    const { mesa_id, items } = req.body;
    if (!items || items.length === 0) {
      draftOrders.delete(mesa_id);
    } else {
      draftOrders.set(mesa_id, { mesa_id, items, updated_at: Date.now() });
    }
    events.emit('update');
    res.json({ success: true });
  });

  app.get('/api/pedidos/draft', (req, res) => {
    res.json(Array.from(draftOrders.values()));
  });

  app.get('/api/mesas', (req, res) => {
    const mesas = db.prepare('SELECT * FROM mesas').all();
    res.json(mesas);
  });

  app.get('/api/categorias', (req, res) => {
    const categorias = db.prepare('SELECT * FROM categorias').all();
    res.json(categorias);
  });

  app.get('/api/productos', (req, res) => {
    const productos = db.prepare('SELECT * FROM productos').all();
    res.json(productos);
  });

  app.post('/api/productos', (req, res) => {
    const { categoria_id, nombre, precio, disponible } = req.body;
    const result = db.prepare('INSERT INTO productos (categoria_id, nombre, precio, disponible) VALUES (?, ?, ?, ?)').run(categoria_id, nombre, precio, disponible === undefined ? 1 : disponible);
    events.emit('update');
    res.json({ id: result.lastInsertRowid, success: true });
  });

  app.put('/api/productos/:id', (req, res) => {
    const { id } = req.params;
    const { categoria_id, nombre, precio, disponible } = req.body;
    db.prepare('UPDATE productos SET categoria_id = ?, nombre = ?, precio = ?, disponible = ? WHERE id = ?').run(categoria_id, nombre, precio, disponible, id);
    events.emit('update');
    res.json({ success: true });
  });

  app.delete('/api/productos/:id', (req, res) => {
    const { id } = req.params;
    try {
      db.prepare('DELETE FROM productos WHERE id = ?').run(id);
      events.emit('update');
      res.json({ success: true });
    } catch (e) {
      // Might fail if product is referenced in pedido_items
      res.status(400).json({ error: 'No se puede eliminar un producto que ya tiene pedidos. Intente marcarlo como no disponible.' });
    }
  });

  app.get('/api/sabores', (req, res) => {
    const sabores = db.prepare('SELECT * FROM sabores').all();
    res.json(sabores);
  });

  app.put('/api/sabores/:id/toggle', (req, res) => {
    const { id } = req.params;
    const sabor = db.prepare('SELECT disponible FROM sabores WHERE id = ?').get(id) as any;
    if (sabor) {
      db.prepare('UPDATE sabores SET disponible = ? WHERE id = ?').run(sabor.disponible ? 0 : 1, id);
      events.emit('update');
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Sabor no encontrado' });
    }
  });

  // Get active orders (for KDS and Admin)
  app.get('/api/pedidos/activos', (req, res) => {
    const pedidos = db.prepare(`
      SELECT p.id, p.mesa_id, m.nombre as mesa_numero, p.estado, p.creado_en, p.juego_minutos, p.juego_inicio, p.juego_estado, p.juego_restante_ms,
             COALESCE((SELECT SUM(monto) FROM pagos WHERE pedido_id = p.id), 0) as pagado
      FROM pedidos p
      JOIN mesas m ON p.mesa_id = m.id
      WHERE p.estado = 'abierto'
      ORDER BY p.creado_en ASC, p.id ASC
    `).all();

    const itemsStmt = db.prepare(`
      SELECT pi.id, pi.pedido_id, pi.producto_id, pr.nombre as producto_nombre, pi.cantidad, pi.estado, pi.notas, pi.pagado_cantidad
      FROM pedido_items pi
      JOIN productos pr ON pi.producto_id = pr.id
      WHERE pi.pedido_id = ?
      ORDER BY pi.id ASC
    `);

    const result = pedidos.map((p: any) => ({
      ...p,
      items: itemsStmt.all(p.id)
    }));

    res.json(result);
  });

  // Direct payment for Mesa A (Counter orders)
  app.post('/api/pedidos/pago-directo', (req, res) => {
    const { mesa_id, items, metodo } = req.body;
    
    const transaction = db.transaction(() => {
      const result = db.prepare("INSERT INTO pedidos (mesa_id, estado) VALUES (?, 'pagado')").run(mesa_id);
      const pedidoId = result.lastInsertRowid;
      
      let total = 0;
      const insertItem = db.prepare("INSERT INTO pedido_items (pedido_id, producto_id, cantidad, estado, notas) VALUES (?, ?, ?, 'entregado', ?)");
      for (const item of items) {
        insertItem.run(pedidoId, item.producto_id, item.cantidad, item.notas || null);
        const prod = db.prepare("SELECT precio FROM productos WHERE id = ?").get(item.producto_id) as any;
        total += (prod.precio * item.cantidad);
      }
      
      db.prepare("INSERT INTO pagos (pedido_id, metodo, monto) VALUES (?, ?, ?)").run(pedidoId, metodo || 'Efectivo', total);
    });

    transaction();
    draftOrders.delete(mesa_id);
    events.emit('update');
    res.json({ success: true });
  });

  // Create or add to order
  app.post('/api/pedidos', (req, res) => {
    const { mesa_id, items } = req.body;
    
    const transaction = db.transaction(() => {
      let pedido = db.prepare("SELECT id, juego_minutos, juego_inicio, juego_estado, juego_restante_ms FROM pedidos WHERE mesa_id = ? AND estado = 'abierto'").get(mesa_id) as any;
      
      let isNewPedido = false;
      if (!pedido) {
        const result = db.prepare("INSERT INTO pedidos (mesa_id) VALUES (?)").run(mesa_id);
        pedido = { id: result.lastInsertRowid, juego_minutos: 0, juego_estado: 'activo', juego_restante_ms: 0 };
        db.prepare("UPDATE mesas SET estado = 'ocupada' WHERE id = ?").run(mesa_id);
        isNewPedido = true;
      }

      let newGameItem = items.find((i: any) => [67, 68, 69, 70].includes(i.producto_id));
      
      if (newGameItem) {
        // Remove existing game items so they don't accumulate
        db.prepare("DELETE FROM pedido_items WHERE pedido_id = ? AND producto_id IN (67, 68, 69, 70)").run(pedido.id);
      }

      const insertItem = db.prepare("INSERT INTO pedido_items (pedido_id, producto_id, cantidad, notas) VALUES (?, ?, ?, ?)");
      for (const item of items) {
        insertItem.run(pedido.id, item.producto_id, item.cantidad, item.notas || null);
      }

      // If it's an existing order with an active timer, and we're adding new non-game items, restart the timer
      if (!isNewPedido && !newGameItem && pedido.juego_minutos > 0) {
        const now = new Date().toISOString();
        db.prepare("UPDATE pedidos SET juego_inicio = ?, juego_estado = 'activo', juego_restante_ms = ? WHERE id = ?")
          .run(now, pedido.juego_minutos * 60000, pedido.id);
      }

      if (newGameItem) {
        let newMinutes = 0;
        if (newGameItem.producto_id === 67) newMinutes = 15;
        if (newGameItem.producto_id === 68) newMinutes = 30;
        if (newGameItem.producto_id === 69) newMinutes = 60;
        if (newGameItem.producto_id === 70) newMinutes = 0; // Ficha

        if (newMinutes > 0) {
          if (!pedido.juego_inicio || (!isNewPedido && !newGameItem)) {
            const now = new Date().toISOString();
            db.prepare("UPDATE pedidos SET juego_minutos = ?, juego_inicio = ?, juego_estado = 'activo', juego_restante_ms = ? WHERE id = ?")
              .run(newMinutes, now, newMinutes * 60000, pedido.id);
          } else {
            if (pedido.juego_estado === 'pausado') {
              const diffMs = (newMinutes - (pedido.juego_minutos || 0)) * 60000;
              const newRemainingMs = Math.max(0, (pedido.juego_restante_ms || 0) + diffMs);
              db.prepare("UPDATE pedidos SET juego_minutos = ?, juego_restante_ms = ? WHERE id = ?")
                .run(newMinutes, newRemainingMs, pedido.id);
            } else {
              // Restart timer when changing game time
              const now = new Date().toISOString();
              db.prepare("UPDATE pedidos SET juego_minutos = ?, juego_inicio = ?, juego_estado = 'activo', juego_restante_ms = ? WHERE id = ?")
                .run(newMinutes, now, newMinutes * 60000, pedido.id);
            }
          }
        } else {
          // Ficha: clear timer
          db.prepare("UPDATE pedidos SET juego_minutos = 0, juego_inicio = NULL, juego_estado = 'activo', juego_restante_ms = 0 WHERE id = ?").run(pedido.id);
        }
      }
    });

    transaction();
    draftOrders.delete(mesa_id);
    events.emit('update');
    res.json({ success: true });
  });

  // Pause timer
  app.post('/api/pedidos/:id/pausar', (req, res) => {
    const { id } = req.params;
    const pedido = db.prepare("SELECT juego_inicio, juego_minutos, juego_estado, juego_restante_ms FROM pedidos WHERE id = ?").get(id) as any;
    
    if (pedido && pedido.juego_estado === 'activo' && pedido.juego_inicio) {
      const elapsedMs = Date.now() - new Date(pedido.juego_inicio).getTime();
      const totalMs = pedido.juego_minutos * 60000;
      const remainingMs = Math.max(0, totalMs - elapsedMs);
      
      db.prepare("UPDATE pedidos SET juego_estado = 'pausado', juego_restante_ms = ? WHERE id = ?").run(remainingMs, id);
      events.emit('update');
    }
    res.json({ success: true });
  });

  // Resume timer
  app.post('/api/pedidos/:id/reanudar', (req, res) => {
    const { id } = req.params;
    const pedido = db.prepare("SELECT juego_minutos, juego_estado, juego_restante_ms FROM pedidos WHERE id = ?").get(id) as any;
    
    if (pedido && pedido.juego_estado === 'pausado') {
      const totalMs = pedido.juego_minutos * 60000;
      const elapsedMs = totalMs - pedido.juego_restante_ms;
      const newInicio = new Date(Date.now() - elapsedMs).toISOString();
      
      db.prepare("UPDATE pedidos SET juego_estado = 'activo', juego_inicio = ? WHERE id = ?").run(newInicio, id);
      events.emit('update');
    }
    res.json({ success: true });
  });

  // Update item status (KDS)
  app.put('/api/pedido_items/:id/estado', (req, res) => {
    const { id } = req.params;
    const { estado } = req.body; // 'pendiente', 'preparando', 'listo'
    
    db.prepare("UPDATE pedido_items SET estado = ? WHERE id = ?").run(estado, id);
    events.emit('update');
    res.json({ success: true });
  });

  // Delete item from order
  app.delete('/api/pedido_items/:id', (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM pedido_items WHERE id = ?").run(id);
    events.emit('update');
    res.json({ success: true });
  });

  // Close table and pay
  app.post('/api/pedidos/:id/pagar', (req, res) => {
    const { id } = req.params;
    const { metodo, monto, cerrarMesa } = req.body;

    const transaction = db.transaction(() => {
      const pedido = db.prepare("SELECT mesa_id FROM pedidos WHERE id = ?").get(id) as any;
      if (pedido) {
        db.prepare("INSERT INTO pagos (pedido_id, metodo, monto) VALUES (?, ?, ?)").run(id, metodo, monto);
        
        if (cerrarMesa) {
          db.prepare("UPDATE pedidos SET estado = 'pagado' WHERE id = ?").run(id);
          db.prepare("UPDATE mesas SET estado = 'disponible' WHERE id = ?").run(pedido.mesa_id);
        }
      }
    });

    transaction();
    events.emit('update');
    res.json({ success: true });
  });

  app.post('/api/pedidos/:id/pagar-items', (req, res) => {
    const { id } = req.params;
    const { metodo, monto, cerrarMesa, items } = req.body;

    const transaction = db.transaction(() => {
      const pedido = db.prepare("SELECT mesa_id FROM pedidos WHERE id = ?").get(id) as any;
      if (pedido) {
        db.prepare("INSERT INTO pagos (pedido_id, metodo, monto) VALUES (?, ?, ?)").run(id, metodo, monto);
        
        // Update pagado_cantidad for each item
        const updateItem = db.prepare("UPDATE pedido_items SET pagado_cantidad = pagado_cantidad + ? WHERE id = ?");
        for (const item of items) {
          updateItem.run(item.cantidad, item.id);
        }

        if (cerrarMesa) {
          db.prepare("UPDATE pedidos SET estado = 'pagado' WHERE id = ?").run(id);
          db.prepare("UPDATE mesas SET estado = 'disponible' WHERE id = ?").run(pedido.mesa_id);
        }
      }
    });

    transaction();
    events.emit('update');
    res.json({ success: true });
  });

  // Gastos
  app.get('/api/gastos', (req, res) => {
    const { fecha } = req.query;
    let query = "SELECT * FROM gastos";
    let params: any[] = [];
    
    if (fecha) {
      query += " WHERE date(fecha) = date(?)";
      params.push(fecha);
    }
    
    query += " ORDER BY fecha DESC";
    
    const gastos = db.prepare(query).all(...params);
    res.json(gastos);
  });

  app.post('/api/gastos', (req, res) => {
    const { descripcion, categoria, monto, fecha } = req.body;
    const result = db.prepare("INSERT INTO gastos (descripcion, categoria, monto, fecha) VALUES (?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))")
      .run(descripcion, categoria, monto, fecha);
    res.json({ success: true, id: result.lastInsertRowid });
  });

  // Ventas y Reportes
  app.get('/api/reportes/ventas', (req, res) => {
    const { fecha } = req.query;
    let dateFilter = fecha ? "date(p.creado_en) = date(?)" : "date(p.creado_en) = date('now', 'localtime')";
    let params = fecha ? [fecha] : [];

    // Total ventas
    const ventas = db.prepare(`
      SELECT COALESCE(SUM(pa.monto), 0) as total
      FROM pagos pa
      JOIN pedidos p ON pa.pedido_id = p.id
      WHERE ${dateFilter}
    `).get(...params) as any;

    // Total gastos
    let gastosFilter = fecha ? "date(fecha) = date(?)" : "date(fecha) = date('now', 'localtime')";
    const gastos = db.prepare(`
      SELECT COALESCE(SUM(monto), 0) as total
      FROM gastos
      WHERE ${gastosFilter}
    `).get(...params) as any;

    res.json({
      ventas: ventas.total,
      gastos: gastos.total,
      ganancia: ventas.total - gastos.total
    });
  });

  app.get('/api/reportes/productos', (req, res) => {
    const { fecha } = req.query;
    let dateFilter = fecha ? "date(p.creado_en) = date(?)" : "date(p.creado_en) = date('now', 'localtime')";
    let params = fecha ? [fecha] : [];

    const productos = db.prepare(`
      SELECT pr.nombre, SUM(pi.cantidad) as cantidad, SUM(pi.cantidad * pr.precio) as total
      FROM pedido_items pi
      JOIN pedidos p ON pi.pedido_id = p.id
      JOIN productos pr ON pi.producto_id = pr.id
      WHERE ${dateFilter} AND p.estado = 'pagado'
      GROUP BY pr.id
      ORDER BY cantidad DESC
    `).all(...params);

    res.json(productos);
  });

  // Error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Server Error:', err);
    res.status(500).json({ error: err.message });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
