import React, { useState, useEffect, useCallback } from 'react';
import { Pedido, Producto } from '../types';
import { useSSE } from '../hooks/useSSE';
import { TimerDisplay } from './TimerDisplay';
import { CreditCard, DollarSign, Wallet, Building2, Receipt, X, Utensils, Pause, Play } from 'lucide-react';

export default function AdminView() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('Efectivo');

  const fetchData = useCallback(async () => {
    try {
      const [pedidosRes, prodRes] = await Promise.all([
        fetch('/api/pedidos/activos'),
        fetch('/api/productos')
      ]);
      
      if (pedidosRes.ok) setPedidos(await pedidosRes.json());
      if (prodRes.ok) setProductos(await prodRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useSSE('/api/events', fetchData);

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
    <div className="p-6 h-full overflow-y-auto bg-gray-50">
      <div className="flex items-center gap-3 mb-8">
        <Receipt className="w-8 h-8 text-gray-900" />
        <h1 className="text-3xl font-bold text-gray-900">Mesas Ocupadas (Caja)</h1>
      </div>

      {pedidos.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
          <Receipt className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-xl font-medium">No hay mesas ocupadas en este momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
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
    </div>
  );
}
