import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Mesa, Categoria, Producto, Pedido, Sabor } from '../types';
import { useSSE } from '../hooks/useSSE';
import { TimerDisplay } from './TimerDisplay';
import { Utensils, Coffee, IceCream, Gamepad2, Baby, Sandwich, Check, Clock, ChefHat, CreditCard, ArrowLeft, Plus, Minus, Trash2, Pause, Play, DollarSign, Wallet, Building2, X, Search } from 'lucide-react';

export default function MeseroView() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [sabores, setSabores] = useState<Sabor[]>([]);
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [selectedCategoria, setSelectedCategoria] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<{ producto: Producto; cantidad: number }[]>([]);
  const [pedidosActivos, setPedidosActivos] = useState<Pedido[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('Efectivo');

  const paymentMethods = [
    { id: 'Efectivo', icon: DollarSign },
    { id: 'Cuenta de Ahorros', icon: Building2 },
    { id: 'Nequi', icon: Wallet },
    { id: 'Daviplata', icon: Wallet },
  ];

  const fetchData = useCallback(async () => {
    try {
      const [mesasRes, catRes, prodRes, pedidosRes, saboresRes] = await Promise.all([
        fetch('/api/mesas'),
        fetch('/api/categorias'),
        fetch('/api/productos'),
        fetch('/api/pedidos/activos'),
        fetch('/api/sabores')
      ]);
      
      if (mesasRes.ok) setMesas(await mesasRes.json());
      if (catRes.ok) setCategorias(await catRes.json());
      if (prodRes.ok) setProductos(await prodRes.json());
      if (pedidosRes.ok) setPedidosActivos(await pedidosRes.json());
      if (saboresRes.ok) setSabores(await saboresRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useSSE('/api/events', fetchData);

  const getIconForCategory = (name: string) => {
    switch (name) {
      case 'Heladería': return <IceCream className="w-6 h-6" />;
      case 'Comidas Rápidas': return <Sandwich className="w-6 h-6" />;
      case 'Bebidas Frías': return <Coffee className="w-6 h-6" />;
      case 'Bebidas Calientes': return <Coffee className="w-6 h-6" />;
      case 'Infantiles': return <Baby className="w-6 h-6" />;
      case 'Juegos': return <Gamepad2 className="w-6 h-6" />;
      default: return <Utensils className="w-6 h-6" />;
    }
  };

  const addToCart = (producto: Producto) => {
    setCart(prev => {
      const existing = prev.find(item => item.producto.id === producto.id);
      if (existing) {
        return prev.map(item => item.producto.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      }
      return [...prev, { producto, cantidad: 1 }];
    });
  };

  const updateQuantity = (productoId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.producto.id === productoId) {
        const newCantidad = item.cantidad + delta;
        return newCantidad > 0 ? { ...item, cantidad: newCantidad } : item;
      }
      return item;
    }).filter(item => item.cantidad > 0));
  };

  const removeFromCart = (productoId: number) => {
    setCart(prev => prev.filter(item => item.producto.id !== productoId));
  };

  // Sync draft order to server
  useEffect(() => {
    if (selectedMesa) {
      fetch('/api/pedidos/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesa_id: selectedMesa.id,
          items: cart.map(item => ({ 
            producto_id: item.producto.id, 
            producto_nombre: item.producto.nombre,
            cantidad: item.cantidad 
          }))
        })
      }).catch(console.error);
    }
  }, [cart, selectedMesa]);

  const submitOrder = async () => {
    if (!selectedMesa || cart.length === 0) return;
    
    if (selectedMesa.id === 1) {
      setShowPaymentModal(true);
      return;
    }

    await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mesa_id: selectedMesa.id,
        items: cart.map(item => ({ producto_id: item.producto.id, cantidad: item.cantidad }))
      })
    });
    
    setCart([]);
    setSelectedMesa(null);
  };

  const processDirectPayment = async () => {
    if (!selectedMesa || cart.length === 0) return;

    await fetch('/api/pedidos/pago-directo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mesa_id: selectedMesa.id,
        metodo: paymentMethod,
        items: cart.map(item => ({ producto_id: item.producto.id, cantidad: item.cantidad }))
      })
    });
    
    setCart([]);
    setSelectedMesa(null);
    setShowPaymentModal(false);
  };

  const pauseTimer = async (pedidoId: number) => {
    await fetch(`/api/pedidos/${pedidoId}/pausar`, { method: 'POST' });
  };

  const resumeTimer = async (pedidoId: number) => {
    await fetch(`/api/pedidos/${pedidoId}/reanudar`, { method: 'POST' });
  };

  const getPedidoForMesa = (mesaId: number) => {
    return pedidosActivos.find(p => p.mesa_id === mesaId);
  };

  const handleBack = () => {
    if (selectedMesa && cart.length > 0) {
      fetch('/api/pedidos/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mesa_id: selectedMesa.id, items: [] })
      }).catch(console.error);
    }
    setSelectedMesa(null);
    setCart([]);
  };

  const toggleSabor = async (id: number) => {
    await fetch(`/api/sabores/${id}/toggle`, { method: 'PUT' });
    fetchData();
  };

  if (selectedMesa) {
    const pedidoActual = getPedidoForMesa(selectedMesa.id);
    const totalCart = cart.reduce((sum, item) => sum + (item.producto.precio * item.cantidad), 0);

    const filteredProductos = productos.filter(p => {
      if (p.disponible === 0) return false;
      if (searchQuery) {
        return p.nombre.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return p.categoria_id === selectedCategoria;
    });

    return (
      <>
        <div className="flex h-full bg-gray-50">
          {/* Left Panel - Menu */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-white p-4 shadow-sm flex items-center gap-4">
              <button onClick={handleBack} className="p-2 hover:bg-gray-100 rounded-full">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h2 className="text-2xl font-bold">Mesa {selectedMesa.nombre}</h2>
              <div className="flex-1 ml-4 relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value) setSelectedCategoria(null);
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {/* Quick References */}
            <div className="mb-6 space-y-4">
              {/* Sabores de Helado */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <IceCream className="w-4 h-4 text-pink-500" />
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Helados (Click para agotar)</h3>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {sabores.filter(s => s.tipo === 'helado').map(sabor => (
                    <button
                      key={sabor.id}
                      onClick={() => toggleSabor(sabor.id)}
                      className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                        sabor.disponible 
                          ? 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100' 
                          : 'bg-gray-100 text-gray-400 border-gray-200 line-through hover:bg-gray-200'
                      }`}
                    >
                      {sabor.nombre}
                    </button>
                  ))}
                </div>
              </div>

              {/* Jugos */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Coffee className="w-4 h-4 text-orange-500" />
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Jugos</h3>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {sabores.filter(s => s.tipo === 'jugo').map(sabor => (
                    <button
                      key={sabor.id}
                      onClick={() => toggleSabor(sabor.id)}
                      className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                        sabor.disponible 
                          ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' 
                          : 'bg-gray-100 text-gray-400 border-gray-200 line-through hover:bg-gray-200'
                      }`}
                    >
                      {sabor.nombre}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aromáticas */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Coffee className="w-4 h-4 text-green-500" />
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Aromáticas</h3>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {sabores.filter(s => s.tipo === 'aromatica').map(sabor => (
                    <button
                      key={sabor.id}
                      onClick={() => toggleSabor(sabor.id)}
                      className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                        sabor.disponible 
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                          : 'bg-gray-100 text-gray-400 border-gray-200 line-through hover:bg-gray-200'
                      }`}
                    >
                      {sabor.nombre}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {!searchQuery && (
              <div className="grid grid-cols-3 gap-4 mb-8">
                {categorias.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoria(cat.id)}
                    className={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors ${selectedCategoria === cat.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-700 hover:bg-indigo-50 border border-gray-200'}`}
                  >
                    {getIconForCategory(cat.nombre)}
                    <span className="font-medium text-sm text-center">{cat.nombre}</span>
                  </button>
                ))}
              </div>
            )}

            {(selectedCategoria || searchQuery) && (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProductos.map(prod => (
                  <button
                    key={prod.id}
                    onClick={() => addToCart(prod)}
                    className="p-4 bg-white border border-gray-200 rounded-xl text-left hover:border-indigo-300 hover:shadow-sm transition-all"
                  >
                    <div className="font-medium text-gray-900 mb-1">{prod.nombre}</div>
                    <div className="text-indigo-600 font-semibold">${prod.precio.toLocaleString()}</div>
                  </button>
                ))}
                {filteredProductos.length === 0 && (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    No se encontraron productos.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Cart & Current Order */}
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-bold">Pedido Actual</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {/* Existing Order Items */}
            {pedidoActual && pedidoActual.items.length > 0 && (
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Enviado a Cocina</h4>
                  {pedidoActual.juego_minutos && pedidoActual.juego_minutos > 0 ? (
                    <div className="flex items-center gap-2">
                      <TimerDisplay 
                        inicio={pedidoActual.juego_inicio!} 
                        minutos={pedidoActual.juego_minutos} 
                        estado={pedidoActual.juego_estado as any}
                        restanteMs={pedidoActual.juego_restante_ms!}
                        className="text-sm bg-gray-100 px-2 py-1 rounded-md"
                      />
                      {pedidoActual.juego_estado === 'activo' ? (
                        <button onClick={() => pauseTimer(pedidoActual.id)} className="p-1.5 bg-amber-100 text-amber-700 rounded hover:bg-amber-200" title="Pausar">
                          <Pause className="w-4 h-4" />
                        </button>
                      ) : (
                        <button onClick={() => resumeTimer(pedidoActual.id)} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200" title="Reanudar">
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-3">
                  {pedidoActual.items.map(item => (
                    <div key={item.id} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{item.cantidad}x</span>
                        <span className="text-gray-700">{item.producto_nombre}</span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        item.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                        item.estado === 'preparando' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {item.estado}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100"></div>
              </div>
            )}

            {/* New Cart Items */}
            {cart.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Nuevo Pedido</h4>
                <div className="space-y-4">
                  {cart.map(item => (
                    <div key={item.producto.id} className="flex flex-col gap-2">
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-900">{item.producto.nombre}</span>
                        <span className="font-semibold text-gray-900">${(item.producto.precio * item.cantidad).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 bg-gray-100 rounded-lg p-1">
                          <button onClick={() => updateQuantity(item.producto.id, -1)} className="p-1 bg-white rounded shadow-sm hover:bg-gray-50"><Minus className="w-4 h-4" /></button>
                          <span className="font-medium w-4 text-center">{item.cantidad}</span>
                          <button onClick={() => updateQuantity(item.producto.id, 1)} className="p-1 bg-white rounded shadow-sm hover:bg-gray-50"><Plus className="w-4 h-4" /></button>
                        </div>
                        <button onClick={() => removeFromCart(item.producto.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {cart.length === 0 && (!pedidoActual || pedidoActual.items.length === 0) && (
              <div className="text-center text-gray-500 mt-10">
                <Utensils className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No hay productos en el pedido</p>
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-600 font-medium">Total Nuevo</span>
                <span className="text-2xl font-bold text-gray-900">${totalCart.toLocaleString()}</span>
              </div>
              <button
                onClick={submitOrder}
                className={`w-full py-3 rounded-xl font-bold text-lg shadow-md transition-colors flex items-center justify-center gap-2 ${
                  selectedMesa.id === 1 
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {selectedMesa.id === 1 ? (
                  <>
                    <DollarSign className="w-6 h-6" />
                    Cobrar Pedido
                  </>
                ) : (
                  <>
                    <ChefHat className="w-6 h-6" />
                    Enviar a Cocina
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal for Mesa A */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-900 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold">Cobrar {selectedMesa?.nombre}</h2>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Total a pagar:</span>
                  <span className="text-3xl font-black text-gray-900">
                    ${totalCart.toLocaleString()}
                  </span>
                </div>
              </div>
              <h3 className="font-bold text-gray-700 mb-3 uppercase text-sm tracking-wider">Método de Pago</h3>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {paymentMethods.map(method => {
                  const Icon = method.icon;
                  return (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={`p-3 rounded-lg border flex flex-col items-center justify-center gap-2 transition-colors ${
                        paymentMethod === method.id 
                          ? 'bg-green-50 border-green-500 text-green-700 font-bold' 
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                      <span className="text-sm text-center">{method.id}</span>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={processDirectPayment}
                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-6 h-6" />
                Confirmar Pago
              </button>
            </div>
          </div>
        </div>
      )}
      </>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto bg-gray-50">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Mapa de Mesas</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {mesas.map(mesa => (
          <button
            key={mesa.id}
            onClick={() => setSelectedMesa(mesa)}
            className={`relative p-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all transform hover:scale-105 shadow-sm ${
              mesa.estado === 'ocupada' 
                ? 'bg-red-50 border-2 border-red-200 text-red-700 hover:bg-red-100' 
                : 'bg-emerald-50 border-2 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <span className="text-2xl font-black text-center leading-tight">{mesa.nombre}</span>
            <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
              mesa.estado === 'ocupada' ? 'bg-red-200 text-red-800' : 'bg-emerald-200 text-emerald-800'
            }`}>
              {mesa.estado}
            </span>
            {mesa.estado === 'ocupada' && (
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                <Utensils className="w-3 h-3 text-white" />
              </div>
            )}
            {mesa.estado === 'ocupada' && getPedidoForMesa(mesa.id)?.juego_minutos ? (
              <TimerDisplay 
                inicio={getPedidoForMesa(mesa.id)!.juego_inicio!} 
                minutos={getPedidoForMesa(mesa.id)!.juego_minutos!} 
                estado={getPedidoForMesa(mesa.id)!.juego_estado as any}
                restanteMs={getPedidoForMesa(mesa.id)!.juego_restante_ms!}
                className="mt-1 text-xs bg-white/80 px-2 py-1 rounded-full shadow-sm"
              />
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
