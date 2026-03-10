import { db } from '../firebase';
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Mesa, Categoria, Producto, Pedido, Sabor } from '../types';

// Colecciones
const mesasRef = collection(db, 'mesas');
const categoriasRef = collection(db, 'categorias');
const productosRef = collection(db, 'productos');
const saboresRef = collection(db, 'sabores');
const pedidosRef = collection(db, 'pedidos');
const pagosRef = collection(db, 'pagos');
const gastosRef = collection(db, 'gastos');
const draftRef = collection(db, 'draft_orders');

export const subscribeToMesas = (callback: (mesas: Mesa[]) => void) => {
  return onSnapshot(mesasRef, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: Number(doc.id), ...doc.data() } as Mesa)));
  });
};

export const subscribeToCategorias = (callback: (categorias: Categoria[]) => void) => {
  return onSnapshot(categoriasRef, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: Number(doc.id), ...doc.data() } as Categoria)));
  });
};

export const subscribeToProductos = (callback: (productos: Producto[]) => void) => {
  return onSnapshot(productosRef, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: Number(doc.id), ...doc.data() } as Producto)));
  });
};

export const subscribeToSabores = (callback: (sabores: Sabor[]) => void) => {
  return onSnapshot(saboresRef, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: Number(doc.id), ...doc.data() } as Sabor)));
  });
};

export const subscribeToPedidosActivos = (callback: (pedidos: Pedido[]) => void) => {
  const q = query(pedidosRef, where('estado', '==', 'abierto'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: Number(doc.id), ...doc.data() } as Pedido)));
  });
};

export const subscribeToDraftOrders = (callback: (drafts: any[]) => void) => {
  return onSnapshot(draftRef, (snapshot) => {
    callback(snapshot.docs.map(doc => doc.data()));
  });
};

// Acciones
export const saveDraftOrder = async (mesa_id: number, items: any[]) => {
  const docRef = doc(draftRef, mesa_id.toString());
  if (items.length === 0) {
    await deleteDoc(docRef);
  } else {
    await setDoc(docRef, { mesa_id, items, updated_at: Date.now() });
  }
};

export const submitOrder = async (mesa_id: number, items: any[], mesa_nombre: string) => {
  const batch = writeBatch(db);
  
  // Buscar si hay un pedido abierto para esta mesa
  const q = query(pedidosRef, where('mesa_id', '==', mesa_id), where('estado', '==', 'abierto'));
  const snapshot = await getDocs(q);
  
  let pedidoRef;
  let pedidoData: any;
  
  if (snapshot.empty) {
    // Nuevo pedido
    pedidoRef = doc(pedidosRef, Date.now().toString());
    pedidoData = {
      id: Number(pedidoRef.id),
      mesa_id,
      mesa_numero: mesa_nombre,
      estado: 'abierto',
      creado_en: new Date().toISOString(),
      juego_minutos: 0,
      juego_estado: 'activo',
      juego_restante_ms: 0,
      pagado: 0,
      items: []
    };
    // Actualizar estado de la mesa
    batch.update(doc(mesasRef, mesa_id.toString()), { estado: 'ocupada' });
  } else {
    pedidoRef = snapshot.docs[0].ref;
    pedidoData = snapshot.docs[0].data();
  }

  // Procesar items y juegos
  let newGameItem = items.find((i: any) => [67, 68, 69, 70].includes(i.producto_id));
  
  if (newGameItem) {
    // Remover items de juego anteriores
    pedidoData.items = pedidoData.items.filter((i: any) => ![67, 68, 69, 70].includes(i.producto_id));
  }

  // Agregar nuevos items
  const newItems = items.map(item => ({
    id: Date.now() + Math.random(),
    producto_id: item.producto_id,
    producto_nombre: item.producto_nombre || item.producto?.nombre,
    cantidad: item.cantidad,
    notas: item.notas || '',
    estado: 'pendiente',
    pagado_cantidad: 0,
    creado_en: new Date().toISOString()
  }));

  pedidoData.items = [...pedidoData.items, ...newItems];

  // Lógica de tiempo de juego
  if (newGameItem) {
    let newMinutes = 0;
    if (newGameItem.producto_id === 67) newMinutes = 15;
    if (newGameItem.producto_id === 68) newMinutes = 30;
    if (newGameItem.producto_id === 69) newMinutes = 60;
    if (newGameItem.producto_id === 70) newMinutes = 0; // Ficha

    if (newMinutes > 0) {
      pedidoData.juego_minutos = newMinutes;
      pedidoData.juego_inicio = new Date().toISOString();
      pedidoData.juego_estado = 'activo';
      pedidoData.juego_restante_ms = newMinutes * 60000;
    } else {
      pedidoData.juego_minutos = 0;
      pedidoData.juego_inicio = null;
      pedidoData.juego_estado = 'activo';
      pedidoData.juego_restante_ms = 0;
    }
  } else if (pedidoData.juego_minutos > 0) {
    // Restart timer if adding normal items to an active game
    pedidoData.juego_inicio = new Date().toISOString();
    pedidoData.juego_estado = 'activo';
    pedidoData.juego_restante_ms = pedidoData.juego_minutos * 60000;
  }

  batch.set(pedidoRef, pedidoData);
  
  // Limpiar draft
  batch.delete(doc(draftRef, mesa_id.toString()));
  
  await batch.commit();
};

export const processDirectPayment = async (mesa_id: number, items: any[], metodo: string, mesa_nombre: string) => {
  const batch = writeBatch(db);
  
  const pedidoId = Date.now();
  const pedidoRef = doc(pedidosRef, pedidoId.toString());
  
  let total = 0;
  // We need prices to calculate total. Assuming items have price or we fetch it.
  // For simplicity, we assume the caller calculates the total or we fetch products here.
  // In a real app, we should fetch products to ensure price accuracy.
  const productosSnap = await getDocs(productosRef);
  const productosMap = new Map(productosSnap.docs.map(d => [Number(d.id), d.data()]));

  const processedItems = items.map(item => {
    const prod = productosMap.get(item.producto_id) as any;
    total += (prod?.precio || 0) * item.cantidad;
    return {
      id: Date.now() + Math.random(),
      producto_id: item.producto_id,
      producto_nombre: item.producto_nombre || prod?.nombre,
      cantidad: item.cantidad,
      notas: item.notas || '',
      estado: 'entregado',
      pagado_cantidad: item.cantidad,
      creado_en: new Date().toISOString()
    };
  });

  batch.set(pedidoRef, {
    id: pedidoId,
    mesa_id,
    mesa_numero: mesa_nombre,
    estado: 'pagado',
    creado_en: new Date().toISOString(),
    items: processedItems,
    pagado: total
  });

  const pagoRef = doc(pagosRef, Date.now().toString());
  batch.set(pagoRef, {
    pedido_id: pedidoId,
    metodo: metodo || 'Efectivo',
    monto: total,
    creado_en: new Date().toISOString()
  });

  batch.delete(doc(draftRef, mesa_id.toString()));
  await batch.commit();
};

export const updateItemStatus = async (pedidoId: number, itemId: number, newStatus: string) => {
  const pedidoRef = doc(pedidosRef, pedidoId.toString());
  const snap = await getDoc(pedidoRef);
  if (snap.exists()) {
    const data = snap.data();
    const newItems = data.items.map((i: any) => i.id === itemId ? { ...i, estado: newStatus } : i);
    await updateDoc(pedidoRef, { items: newItems });
  }
};

export const toggleSabor = async (saborId: number, currentState: boolean) => {
  const ref = doc(saboresRef, saborId.toString());
  await updateDoc(ref, { disponible: !currentState });
};

export const pauseTimer = async (pedidoId: number) => {
  const ref = doc(pedidosRef, pedidoId.toString());
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    if (data.juego_estado === 'activo' && data.juego_inicio) {
      const elapsedMs = Date.now() - new Date(data.juego_inicio).getTime();
      const totalMs = data.juego_minutos * 60000;
      const remainingMs = Math.max(0, totalMs - elapsedMs);
      await updateDoc(ref, { juego_estado: 'pausado', juego_restante_ms: remainingMs });
    }
  }
};

export const resumeTimer = async (pedidoId: number) => {
  const ref = doc(pedidosRef, pedidoId.toString());
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    if (data.juego_estado === 'pausado') {
      const totalMs = data.juego_minutos * 60000;
      const elapsedMs = totalMs - data.juego_restante_ms;
      const newInicio = new Date(Date.now() - elapsedMs).toISOString();
      await updateDoc(ref, { juego_estado: 'activo', juego_inicio: newInicio });
    }
  }
};

export const payPedido = async (pedidoId: number, monto: number, metodo: string, cerrarMesa: boolean, mesaId: number) => {
  const batch = writeBatch(db);
  const pedidoRef = doc(pedidosRef, pedidoId.toString());
  const snap = await getDoc(pedidoRef);
  
  if (snap.exists()) {
    const data = snap.data();
    const newPagado = (data.pagado || 0) + monto;
    
    batch.update(pedidoRef, { 
      pagado: newPagado,
      estado: cerrarMesa ? 'pagado' : 'abierto'
    });

    if (cerrarMesa) {
      batch.update(doc(mesasRef, mesaId.toString()), { estado: 'disponible' });
    }

    const pagoRef = doc(pagosRef, Date.now().toString());
    batch.set(pagoRef, {
      pedido_id: pedidoId,
      metodo,
      monto,
      creado_en: new Date().toISOString()
    });

    await batch.commit();
  }
};

export const cancelItem = async (pedidoId: number, itemId: number) => {
  const pedidoRef = doc(pedidosRef, pedidoId.toString());
  const snap = await getDoc(pedidoRef);
  if (snap.exists()) {
    const data = snap.data();
    const newItems = data.items.filter((i: any) => i.id !== itemId);
    if (newItems.length === 0) {
      // Si no quedan items, cancelamos el pedido y liberamos la mesa
      const batch = writeBatch(db);
      batch.update(pedidoRef, { estado: 'cancelado', items: [] });
      batch.update(doc(mesasRef, data.mesa_id.toString()), { estado: 'disponible' });
      await batch.commit();
    } else {
      await updateDoc(pedidoRef, { items: newItems });
    }
  }
};

export const subscribeToGastos = (fecha: string, callback: (gastos: any[]) => void) => {
  const q = query(gastosRef, where('fecha', '==', fecha));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: Number(doc.id), ...doc.data() }));
    callback(data);
  });
};

export const addGasto = async (gasto: any) => {
  const id = Date.now();
  await setDoc(doc(gastosRef, id.toString()), { ...gasto, id });
};

export const saveProducto = async (producto: any) => {
  const id = producto.id || Date.now();
  await setDoc(doc(productosRef, id.toString()), { ...producto, id });
};

export const deleteProducto = async (id: number) => {
  await deleteDoc(doc(productosRef, id.toString()));
};

export const toggleProductoAvailability = async (id: number, currentState: boolean) => {
  await updateDoc(doc(productosRef, id.toString()), { disponible: currentState ? 0 : 1 });
};

export const processPayment = async (pedidoId: number, monto: number, metodo: string, cerrarMesa: boolean, itemsToPay?: any[]) => {
  const batch = writeBatch(db);
  const pedidoRef = doc(pedidosRef, pedidoId.toString());
  const snap = await getDoc(pedidoRef);
  
  if (snap.exists()) {
    const data = snap.data();
    const newPagado = (data.pagado || 0) + monto;
    
    let newItems = data.items;
    if (itemsToPay && itemsToPay.length > 0) {
      newItems = data.items.map((item: any) => {
        const toPay = itemsToPay.find(i => i.id === item.id);
        if (toPay) {
          return { ...item, pagado_cantidad: (item.pagado_cantidad || 0) + toPay.cantidad };
        }
        return item;
      });
    }
    
    batch.update(pedidoRef, { 
      pagado: newPagado,
      estado: cerrarMesa ? 'pagado' : 'abierto',
      items: newItems
    });

    if (cerrarMesa) {
      batch.update(doc(mesasRef, data.mesa_id.toString()), { estado: 'disponible' });
    }

    const pagoRef = doc(pagosRef, Date.now().toString());
    batch.set(pagoRef, {
      pedido_id: pedidoId,
      metodo,
      monto,
      creado_en: new Date().toISOString()
    });

    await batch.commit();
  }
};

export const cancelOrderItem = async (pedidoId: number, itemId: number) => {
  const pedidoRef = doc(pedidosRef, pedidoId.toString());
  const snap = await getDoc(pedidoRef);
  if (snap.exists()) {
    const data = snap.data();
    const newItems = data.items.filter((i: any) => i.id !== itemId);
    if (newItems.length === 0) {
      const batch = writeBatch(db);
      batch.update(pedidoRef, { estado: 'cancelado', items: [] });
      batch.update(doc(mesasRef, data.mesa_id.toString()), { estado: 'disponible' });
      await batch.commit();
    } else {
      await updateDoc(pedidoRef, { items: newItems });
    }
  }
};

export const getReportes = async (fecha: string) => {
  const start = new Date(fecha);
  start.setHours(0, 0, 0, 0);
  const end = new Date(fecha);
  end.setHours(23, 59, 59, 999);

  const startStr = start.toISOString();
  const endStr = end.toISOString();

  const pagosQ = query(pagosRef, where('creado_en', '>=', startStr), where('creado_en', '<=', endStr));
  const pagosSnap = await getDocs(pagosQ);
  const totalVentas = pagosSnap.docs.reduce((sum, doc) => sum + doc.data().monto, 0);

  const gastosQ = query(gastosRef, where('fecha', '==', fecha));
  const gastosSnap = await getDocs(gastosQ);
  const totalGastos = gastosSnap.docs.reduce((sum, doc) => sum + doc.data().monto, 0);

  const pedidosQ = query(pedidosRef, where('estado', '==', 'pagado'), where('creado_en', '>=', startStr), where('creado_en', '<=', endStr));
  const pedidosSnap = await getDocs(pedidosQ);
  
  const productCounts: Record<string, { cantidad: number; total: number }> = {};
  
  for (const pDoc of pedidosSnap.docs) {
    const data = pDoc.data();
    for (const item of data.items) {
      if (!productCounts[item.producto_nombre]) {
        productCounts[item.producto_nombre] = { cantidad: 0, total: 0 };
      }
      productCounts[item.producto_nombre].cantidad += item.cantidad;
      // We need price to calculate total per product accurately.
      // For simplicity, we assume the price is proportional or we fetch it.
      // In a real app, we should store the price at the time of purchase in the item.
      // Here we just use a placeholder or fetch the current price.
    }
  }

  // Fetch current prices to estimate total per product
  const productosSnap = await getDocs(productosRef);
  const productosMap = new Map(productosSnap.docs.map(d => [d.data().nombre, d.data().precio]));

  const productos = Object.entries(productCounts).map(([nombre, stats]) => ({
    nombre,
    cantidad: stats.cantidad,
    total: stats.cantidad * (productosMap.get(nombre) || 0)
  })).sort((a, b) => b.cantidad - a.cantidad);

  return {
    ventas: {
      ventas: totalVentas,
      gastos: totalGastos,
      ganancia: totalVentas - totalGastos
    },
    productos
  };
};

// Seed function to initialize DB if empty
export const seedDatabase = async () => {
  const snap = await getDocs(mesasRef);
  if (!snap.empty) return; // Already seeded

  console.log("Seeding database...");
  const batch = writeBatch(db);

  // Mesas
  batch.set(doc(mesasRef, "1"), { id: 1, numero: 1, nombre: 'Mesa A', estado: 'disponible' });
  for (let i = 2; i <= 19; i++) {
    batch.set(doc(mesasRef, i.toString()), { id: i, numero: i, nombre: `${i - 1}`, estado: 'disponible' });
  }
  batch.set(doc(mesasRef, "20"), { id: 20, numero: 20, nombre: 'Sala Roja', estado: 'disponible' });
  batch.set(doc(mesasRef, "21"), { id: 21, numero: 21, nombre: 'Sala Blanca', estado: 'disponible' });
  batch.set(doc(mesasRef, "22"), { id: 22, numero: 22, nombre: 'Sala Verde', estado: 'disponible' });

  // Categorias
  const categorias = [
    [1, 'Heladería'], [2, 'Comidas Rápidas'], [3, 'Bebidas Frías'],
    [4, 'Bebidas Calientes'], [5, 'Infantiles'], [6, 'Juegos']
  ];
  categorias.forEach(c => {
    batch.set(doc(categoriasRef, c[0].toString()), { id: c[0], nombre: c[1] });
  });

  // Productos (Sample)
  const productos = [
    [1, 1, 'Cono de helado', 3500], [2, 1, 'cono 2 sabores', 6000], [3, 1, 'cono 3 sabores', 9000],
    [28, 2, 'Hamburguesa', 17000], [29, 2, 'hamburguesa con Papas', 20000],
    [42, 3, 'Malteada', 7000], [43, 3, 'Granizado de Cafe', 7000],
    [54, 4, 'Milo Caliente', 3500], [55, 4, 'Cafe', 1500],
    [67, 6, '15 minutos', 3000], [68, 6, '30 minutos', 5000], [69, 6, '60 minutos', 7000], [70, 6, 'ficha', 10000]
  ];
  productos.forEach(p => {
    batch.set(doc(productosRef, p[0].toString()), { id: p[0], categoria_id: p[1], nombre: p[2], precio: p[3], disponible: 1 });
  });

  // Sabores
  const opciones = [
    { tipo: 'helado', nombre: 'Fresa' }, { tipo: 'helado', nombre: '3 Leches' }, { tipo: 'helado', nombre: 'Brownie' },
    { tipo: 'jugo', nombre: 'Mora' }, { tipo: 'jugo', nombre: 'Maracuyá' },
    { tipo: 'aromatica', nombre: 'Manzanilla' }, { tipo: 'aromatica', nombre: 'Hierbabuena' }
  ];
  opciones.forEach((o, i) => {
    batch.set(doc(saboresRef, (i+1).toString()), { id: i+1, nombre: o.nombre, tipo: o.tipo, disponible: true });
  });

  await batch.commit();
  console.log("Database seeded!");
};
