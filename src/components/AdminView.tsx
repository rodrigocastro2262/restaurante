import React, { useState, useEffect, useCallback } from 'react';
import { Pedido, Producto, Categoria } from '../types';
import { useSSE } from '../hooks/useSSE';
import { TimerDisplay } from './TimerDisplay';
import { CreditCard, DollarSign, Wallet, Building2, Receipt, X, Utensils, Pause, Play, TrendingUp, TrendingDown, Calendar, Package, Edit3, Plus, Trash2, CheckCircle2, XCircle } from 'lucide-react';

type AdminTab = 'caja' | 'gastos' | 'ventas' | 'productos';

interface DraftOrder {
  mesa_id: number;
  items: { producto_id: number; producto_nombre: string; cantidad: number }[];
  updated_at: number;
}

interface Gasto {
  id: number;
  descripcion: string;
  categoria: string;
  monto: number;
  fecha: string;
}

interface ReporteVentas {
  ventas: number;
  gastos: number;
  ganancia: number;
}

interface ReporteProducto {
  nombre: string;
  cantidad: number;
  total: number;
}

export default function AdminView() {
  const [activeTab, setActiveTab] = useState<AdminTab>('caja');
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [draftOrders, setDraftOrders] = useState<DraftOrder[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('Efectivo');
  
  // Productos state
  const [editingProducto, setEditingProducto] = useState<Producto | null>(null);
  const [newProducto, setNewProducto] = useState({ nombre: '', precio: '', categoria_id: 1, disponible: 1 });
  
  // Gastos state
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [newGasto, setNewGasto] = useState({ descripcion: '', categoria: 'insumos', monto: '' });
  
  // Reportes state
  const [reporteFecha, setReporteFecha] = useState(new Date().toISOString().split('T')[0]);
  const [reporteVentas, setReporteVentas] = useState<ReporteVentas>({ ventas: 0, gastos: 0, ganancia: 0 });
  const [reporteProductos, setReporteProductos] = useState<ReporteProducto[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [pedidosRes, prodRes, draftRes, catRes] = await Promise.all([
        fetch('/api/pedidos/activos'),
        fetch('/api/productos'),
        fetch('/api/pedidos/draft'),
        fetch('/api/categorias')
      ]);
      
      if (pedidosRes.ok) setPedidos(await pedidosRes.json());
      if (prodRes.ok) setProductos(await prodRes.json());
      if (draftRes.ok) setDraftOrders(await draftRes.json());
      if (catRes.ok) setCategorias(await catRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, []);

  const fetchGastos = useCallback(async () => {
    try {
      const res = await fetch(`/api/gastos?fecha=${reporteFecha}`);
      if (res.ok) setGastos(await res.json());
    } catch (error) {
      console.error('Error fetching gastos:', error);
    }
  }, [reporteFecha]);

  const fetchReportes = useCallback(async () => {
    try {
      const [ventasRes, prodRes] = await Promise.all([
        fetch(`/api/reportes/ventas?fecha=${reporteFecha}`),
        fetch(`/api/reportes/productos?fecha=${reporteFecha}`)
      ]);
      
      if (ventasRes.ok) setReporteVentas(await ventasRes.json());
      if (prodRes.ok) setReporteProductos(await prodRes.json());
    } catch (error) {
      console.error('Error fetching reportes:', error);
    }
  }, [reporteFecha]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === 'gastos') fetchGastos();
    if (activeTab === 'ventas') fetchReportes();
  }, [activeTab, reporteFecha, fetchGastos, fetchReportes]);

  useSSE('/api/events', () => {
    fetchData();
    if (activeTab === 'ventas') fetchReportes();
  });

  const handleAddGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGasto.descripcion || !newGasto.monto) return;

    await fetch('/api/gastos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newGasto,
        monto: parseFloat(newGasto.monto),
        fecha: reporteFecha
      })
    });
    
    setNewGasto({ descripcion: '', categoria: 'insumos', monto: '' });
    fetchGastos();
    if (activeTab === 'ventas') fetchReportes();
  };

  const handleSaveProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProducto) {
      await fetch(`/api/productos/${editingProducto.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProducto)
      });
      setEditingProducto(null);
    } else {
      if (!newProducto.nombre || !newProducto.precio) return;
      await fetch('/api/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProducto,
          precio: parseFloat(newProducto.precio)
        })
      });
      setNewProducto({ nombre: '', precio: '', categoria_id: 1, disponible: 1 });
    }
    fetchData();
  };

  const handleDeleteProducto = async (id: number) => {
    if (confirm('¿Estás seguro de que deseas eliminar este producto?')) {
      const res = await fetch(`/api/productos/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error);
      } else {
        fetchData();
      }
    }
  };

  const toggleProductAvailability = async (producto: Producto) => {
    await fetch(`/api/productos/${producto.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...producto, disponible: producto.disponible ? 0 : 1 })
    });
    fetchData();
  };

  const getProductPrice = (id: number) => {
    return productos.find(p => p.id === id)?.precio || 0;
  };

  const calculateTotal = (pedido: Pedido) => {
    return pedido.items.reduce((sum, item) => sum + (getProductPrice(item.producto_id) * item.cantidad), 0);
  };

  const handlePayment = async () => {
    if (!selectedPedido) return;
    
    const total = calculateTotal(selectedPedido);
    
    await fetch(`/api/pedidos/${selectedPedido.id}/pagar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metodo: paymentMethod, monto: total })
    });
    
    setSelectedPedido(null);
  };

  const pauseTimer = async (pedidoId: number) => {
    await fetch(`/api/pedidos/${pedidoId}/pausar`, { method: 'POST' });
  };

  const resumeTimer = async (pedidoId: number) => {
    await fetch(`/api/pedidos/${pedidoId}/reanudar`, { method: 'POST' });
  };

  const paymentMethods = [
    { id: 'Efectivo', icon: DollarSign },
    { id: 'Cuenta de Ahorros', icon: Building2 },
    { id: 'Nequi', icon: Wallet },
    { id: 'Daviplata', icon: Wallet },
  ];

  if (selectedPedido) {
    return (
      <div className="p-6 h-full flex flex-col bg-gray-50 max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden h-full">
          <div className="p-4 border-b border-gray-200 bg-gray-900 text-white flex justify-between items-center">
            <h2 className="text-xl font-bold">Cobrar Mesa {selectedPedido.mesa_numero}</h2>
            <button onClick={() => setSelectedPedido(null)} className="text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-700 uppercase text-sm tracking-wider">Detalle del Pedido</h3>
                  {selectedPedido.juego_minutos && selectedPedido.juego_minutos > 0 ? (
                    <div className="flex items-center gap-2">
                      <TimerDisplay 
                        inicio={selectedPedido.juego_inicio!} 
                        minutos={selectedPedido.juego_minutos} 
                        estado={selectedPedido.juego_estado as any}
                        restanteMs={selectedPedido.juego_restante_ms!}
                        className="text-sm bg-gray-100 px-2 py-1 rounded-md"
                      />
                      {selectedPedido.juego_estado === 'activo' ? (
                        <button onClick={() => pauseTimer(selectedPedido.id)} className="p-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200" title="Pausar">
                          <Pause className="w-4 h-4" />
                        </button>
                      ) : (
                        <button onClick={() => resumeTimer(selectedPedido.id)} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200" title="Reanudar">
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-3 mb-6">
                  {selectedPedido.items.map(item => (
                    <div key={item.id} className="flex justify-between items-center text-sm border-b border-gray-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{item.cantidad}x</span>
                        <span className="text-gray-700">{item.producto_nombre}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          item.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                          item.estado === 'preparando' ? 'bg-blue-100 text-blue-800' :
                          item.estado === 'listo' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {item.estado}
                        </span>
                        <span className="font-medium text-gray-900 w-16 text-right">
                          ${(getProductPrice(item.producto_id) * item.cantidad).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 pt-4 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-700">Total a Pagar</span>
                    <span className="text-3xl font-black text-gray-900">
                      ${calculateTotal(selectedPedido).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-700 mb-4 uppercase text-sm tracking-wider">Método de Pago</h3>
                <div className="grid grid-cols-1 gap-3 mb-6">
                  {paymentMethods.map(method => {
                    const Icon = method.icon;
                    return (
                      <button
                        key={method.id}
                        onClick={() => setPaymentMethod(method.id)}
                        className={`p-4 rounded-xl border flex items-center gap-4 transition-colors ${
                          paymentMethod === method.id 
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold ring-2 ring-indigo-200' 
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="w-6 h-6" />
                        <span className="text-lg">{method.id}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={handlePayment}
              className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xl shadow-md transition-colors flex items-center justify-center gap-2"
            >
              <CreditCard className="w-6 h-6" />
              Confirmar Pago y Liberar Mesa
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Admin Navigation */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('caja')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              activeTab === 'caja' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Receipt className="w-4 h-4" />
            Caja
          </button>
          <button
            onClick={() => setActiveTab('gastos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              activeTab === 'gastos' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            Gastos
          </button>
          <button
            onClick={() => setActiveTab('ventas')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              activeTab === 'ventas' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Ventas y Reportes
          </button>
          <button
            onClick={() => setActiveTab('productos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              activeTab === 'productos' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Package className="w-4 h-4" />
            Productos
          </button>
        </div>
        
        {(activeTab === 'gastos' || activeTab === 'ventas') && (
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-500" />
            <input
              type="date"
              value={reporteFecha}
              onChange={(e) => setReporteFecha(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'caja' && (
          <>
            <div className="flex items-center gap-3 mb-8">
              <Receipt className="w-8 h-8 text-gray-900" />
              <h1 className="text-3xl font-bold text-gray-900">Mesas Ocupadas</h1>
            </div>

            {pedidos.length === 0 && draftOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <Receipt className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-xl font-medium">No hay mesas ocupadas en este momento.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {draftOrders.map(draft => (
                  <div
                    key={`draft-${draft.mesa_id}`}
                    className="relative p-6 rounded-2xl flex flex-col items-center justify-center gap-3 shadow-sm bg-indigo-50 border-2 border-indigo-300 text-indigo-700 opacity-80"
                  >
                    <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 animate-pulse rounded-t-xl"></div>
                    <span className="text-4xl font-black">{draft.mesa_id}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-indigo-200 text-indigo-800 text-center leading-tight">
                      Tomando<br/>Pedido
                    </span>
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-indigo-500 rounded-full border-2 border-white flex items-center justify-center">
                      <Edit3 className="w-3 h-3 text-white" />
                    </div>
                  </div>
                ))}

                {pedidos.map(pedido => (
                  <button
                    key={pedido.id}
                    onClick={() => setSelectedPedido(pedido)}
                    className="relative p-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all transform hover:scale-105 shadow-sm bg-red-50 border-2 border-red-200 text-red-700 hover:bg-red-100"
                  >
                    <span className="text-4xl font-black">{pedido.mesa_numero}</span>
                    <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-red-200 text-red-800">
                      Ocupada
                    </span>
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                      <Utensils className="w-3 h-3 text-white" />
                    </div>
                    {pedido.juego_minutos ? (
                      <TimerDisplay 
                        inicio={pedido.juego_inicio!} 
                        minutos={pedido.juego_minutos} 
                        estado={pedido.juego_estado as any}
                        restanteMs={pedido.juego_restante_ms!}
                        className="mt-1 text-xs bg-white/80 px-2 py-1 rounded-full shadow-sm"
                      />
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'gastos' && (
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-red-500" />
                  Registrar Gasto
                </h2>
                <form onSubmit={handleAddGasto} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Leche, Conos, Pago luz"
                      value={newGasto.descripcion}
                      onChange={e => setNewGasto({...newGasto, descripcion: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                    <select
                      value={newGasto.categoria}
                      onChange={e => setNewGasto({...newGasto, categoria: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="insumos">Insumos (Comida/Bebida)</option>
                      <option value="servicios">Servicios (Luz, Agua, etc)</option>
                      <option value="nomina">Nómina / Empleados</option>
                      <option value="otros">Otros</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Monto ($)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="100"
                      placeholder="0"
                      value={newGasto.monto}
                      onChange={e => setNewGasto({...newGasto, monto: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors"
                  >
                    Guardar Gasto
                  </button>
                </form>
              </div>
            </div>
            
            <div className="md:col-span-2">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-full">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Historial de Gastos ({reporteFecha})</h2>
                {gastos.length === 0 ? (
                  <div className="text-center text-gray-500 py-10">
                    No hay gastos registrados para esta fecha.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 text-sm uppercase tracking-wider text-gray-500">
                          <th className="pb-3 font-medium">Descripción</th>
                          <th className="pb-3 font-medium">Categoría</th>
                          <th className="pb-3 font-medium text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {gastos.map(gasto => (
                          <tr key={gasto.id} className="text-sm">
                            <td className="py-3 font-medium text-gray-900">{gasto.descripcion}</td>
                            <td className="py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                                gasto.categoria === 'insumos' ? 'bg-blue-100 text-blue-800' :
                                gasto.categoria === 'servicios' ? 'bg-purple-100 text-purple-800' :
                                gasto.categoria === 'nomina' ? 'bg-orange-100 text-orange-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {gasto.categoria}
                              </span>
                            </td>
                            <td className="py-3 text-right font-bold text-red-600">
                              -${gasto.monto.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-200">
                          <td colSpan={2} className="py-4 text-right font-bold text-gray-700">Total Gastos:</td>
                          <td className="py-4 text-right font-black text-red-600 text-lg">
                            -${gastos.reduce((sum, g) => sum + g.monto, 0).toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ventas' && (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Resumen Financiero */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <h3 className="text-gray-500 font-medium mb-1">Total Ventas</h3>
                <p className="text-3xl font-black text-gray-900">${reporteVentas.ventas.toLocaleString()}</p>
              </div>
              
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-3">
                  <TrendingDown className="w-6 h-6" />
                </div>
                <h3 className="text-gray-500 font-medium mb-1">Total Gastos</h3>
                <p className="text-3xl font-black text-red-600">-${reporteVentas.gastos.toLocaleString()}</p>
              </div>
              
              <div className={`p-6 rounded-2xl shadow-sm border flex flex-col items-center justify-center text-center ${
                reporteVentas.ganancia >= 0 
                  ? 'bg-emerald-50 border-emerald-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
                  reporteVentas.ganancia >= 0 ? 'bg-emerald-200 text-emerald-700' : 'bg-red-200 text-red-700'
                }`}>
                  <DollarSign className="w-6 h-6" />
                </div>
                <h3 className={`font-medium mb-1 ${reporteVentas.ganancia >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                  Ganancia Neta
                </h3>
                <p className={`text-4xl font-black ${reporteVentas.ganancia >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  ${reporteVentas.ganancia.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Productos Vendidos */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-500" />
                Productos Vendidos ({reporteFecha})
              </h2>
              
              {reporteProductos.length === 0 ? (
                <div className="text-center text-gray-500 py-10">
                  No hay ventas registradas para esta fecha.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 text-sm uppercase tracking-wider text-gray-500">
                        <th className="pb-3 font-medium">Producto</th>
                        <th className="pb-3 font-medium text-center">Cantidad Vendida</th>
                        <th className="pb-3 font-medium text-right">Total Generado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {reporteProductos.map((prod, idx) => (
                        <tr key={idx} className="text-sm">
                          <td className="py-3 font-medium text-gray-900">{prod.nombre}</td>
                          <td className="py-3 text-center">
                            <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full font-bold">
                              {prod.cantidad}
                            </span>
                          </td>
                          <td className="py-3 text-right font-bold text-emerald-600">
                            ${prod.total.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'productos' && (
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 sticky top-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  {editingProducto ? <Edit3 className="w-5 h-5 text-blue-500" /> : <Plus className="w-5 h-5 text-green-500" />}
                  {editingProducto ? 'Editar Producto' : 'Nuevo Producto'}
                </h2>
                <form onSubmit={handleSaveProducto} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Nombre</label>
                    <input
                      type="text"
                      required
                      value={editingProducto ? editingProducto.nombre : newProducto.nombre}
                      onChange={(e) => editingProducto 
                        ? setEditingProducto({...editingProducto, nombre: e.target.value})
                        : setNewProducto({...newProducto, nombre: e.target.value})}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      placeholder="Ej: Hamburguesa"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Precio</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="100"
                      value={editingProducto ? editingProducto.precio : newProducto.precio}
                      onChange={(e) => editingProducto
                        ? setEditingProducto({...editingProducto, precio: parseFloat(e.target.value)})
                        : setNewProducto({...newProducto, precio: e.target.value})}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      placeholder="Ej: 15000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Categoría</label>
                    <select
                      value={editingProducto ? editingProducto.categoria_id : newProducto.categoria_id}
                      onChange={(e) => editingProducto
                        ? setEditingProducto({...editingProducto, categoria_id: parseInt(e.target.value)})
                        : setNewProducto({...newProducto, categoria_id: parseInt(e.target.value)})}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
                    >
                      {categorias.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="pt-2 flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-sm"
                    >
                      {editingProducto ? 'Guardar Cambios' : 'Agregar Producto'}
                    </button>
                    {editingProducto && (
                      <button
                        type="button"
                        onClick={() => setEditingProducto(null)}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-4 rounded-xl transition-colors"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Package className="w-5 h-5 text-indigo-500" />
                    Lista de Productos
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500">
                        <th className="p-4 font-bold">Producto</th>
                        <th className="p-4 font-bold">Categoría</th>
                        <th className="p-4 font-bold text-right">Precio</th>
                        <th className="p-4 font-bold text-center">Estado</th>
                        <th className="p-4 font-bold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {productos.map(prod => {
                        const cat = categorias.find(c => c.id === prod.categoria_id);
                        return (
                          <tr key={prod.id} className={`hover:bg-gray-50 transition-colors ${prod.disponible === 0 ? 'opacity-60 bg-gray-50' : ''}`}>
                            <td className="p-4 font-medium text-gray-900">{prod.nombre}</td>
                            <td className="p-4 text-sm text-gray-500">{cat?.nombre || 'Desconocida'}</td>
                            <td className="p-4 text-right font-bold text-indigo-600">${prod.precio.toLocaleString()}</td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => toggleProductAvailability(prod)}
                                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                                  prod.disponible !== 0 
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                                }`}
                              >
                                {prod.disponible !== 0 ? (
                                  <><CheckCircle2 className="w-3 h-3" /> Disponible</>
                                ) : (
                                  <><XCircle className="w-3 h-3" /> Agotado</>
                                )}
                              </button>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setEditingProducto(prod)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Editar"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteProducto(prod.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
