import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Mesa, Categoria, Producto, Pedido, Sabor } from '../types';
import { TimerDisplay } from './TimerDisplay';
import { Utensils, Coffee, IceCream, Gamepad2, Baby, Sandwich, Check, Clock, ChefHat, CreditCard, ArrowLeft, Plus, Minus, Trash2, Pause, Play, DollarSign, Wallet, Building2, X, Search, MessageCircle } from 'lucide-react';
import { 
  subscribeToMesas, 
  subscribeToCategorias, 
  subscribeToProductos, 
  subscribeToPedidosActivos, 
  subscribeToSabores,
  saveDraftOrder,
  submitOrder,
  processDirectPayment,
  pauseTimer,
  resumeTimer,
  toggleSabor
} from '../services/db';

export default function MeseroView() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [sabores, setSabores] = useState<Sabor[]>([]);
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [selectedCategoria, setSelectedCategoria] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<{ id: string; producto: Producto; cantidad: number; notas: string; sabores?: string[] }[]>([]);
  const [pedidosActivos, setPedidosActivos] = useState<Pedido[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('Efectivo');
  const [clientPhone, setClientPhone] = useState<string>('');

  const paymentMethods = [
    { id: 'Efectivo', icon: DollarSign },
    { id: 'Cuenta de Ahorros', icon: Building2 },
    { id: 'Nequi', icon: Wallet },
    { id: 'Daviplata', icon: Wallet },
  ];

  useEffect(() => {
    const unsubMesas = subscribeToMesas(setMesas);
    const unsubCat = subscribeToCategorias(setCategorias);
    const unsubProd = subscribeToProductos(setProductos);
    const unsubPedidos = subscribeToPedidosActivos(setPedidosActivos);
    const unsubSabores = subscribeToSabores(setSabores);

    return () => {
      unsubMesas();
      unsubCat();
      unsubProd();
      unsubPedidos();
      unsubSabores();
    };
  }, []);

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

  const addToCart = (producto: Producto, notas: string = '') => {
    setCart(prev => {
      const existing = prev.find(item => item.producto.id === producto.id && item.notas === notas && (!item.sabores || item.sabores.length === 0));
      if (existing) {
        return prev.map(item => item.id === existing.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      }
      return [...prev, { id: Math.random().toString(36).substring(7), producto, cantidad: 1, notas, sabores: ['', '', ''] }];
    });
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === cartItemId) {
        const newCantidad = item.cantidad + delta;
        return newCantidad > 0 ? { ...item, cantidad: newCantidad } : item;
      }
      return item;
    }).filter(item => item.cantidad > 0));
  };

  const updateNotas = (cartItemId: string, notas: string) => {
    setCart(prev => prev.map(item => item.id === cartItemId ? { ...item, notas } : item));
  };

  const updateSabor = (cartItemId: string, index: number, sabor: string) => {
    setCart(prev => prev.map(item => {
      if (item.id === cartItemId) {
        const newSabores = [...(item.sabores || ['', '', ''])];
        newSabores[index] = sabor;
        return { ...item, sabores: newSabores };
      }
      return item;
    }));
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(prev => prev.filter(item => item.id !== cartItemId));
  };

  // Sync draft order to server
  useEffect(() => {
    if (selectedMesa) {
      const items = cart.map(item => {
        const selectedSabores = item.sabores?.filter(s => s).join(', ');
        const finalNotas = [selectedSabores, item.notas].filter(n => n).join(' | ');
        return { 
          producto_id: item.producto.id, 
          producto_nombre: item.producto.nombre,
          cantidad: item.cantidad,
          notas: finalNotas
        };
      });
      saveDraftOrder(selectedMesa.id, items).catch(console.error);
    }
  }, [cart, selectedMesa]);

  const handleSubmitOrder = async () => {
    if (!selectedMesa || cart.length === 0) return;
    
    if (selectedMesa.id === 1) {
      setShowPaymentModal(true);
      return;
    }

    const items = cart.map(item => {
      const selectedSabores = item.sabores?.filter(s => s).join(', ');
      const finalNotas = [selectedSabores, item.notas].filter(n => n).join(' | ');
      return { producto_id: item.producto.id, producto_nombre: item.producto.nombre, cantidad: item.cantidad, notas: finalNotas };
    });

    await submitOrder(selectedMesa.id, items, selectedMesa.nombre);
    
    setCart([]);
    setSelectedMesa(null);
  };

  const sendWhatsAppReceipt = () => {
    if (!clientPhone) return;
    const totalCart = cart.reduce((sum, item) => sum + (item.producto.precio * item.cantidad), 0);
    
    let text = `🍦 *HELADERÍA ARCOIRIS* 🌈\n`;
    text += `📍 Carrera 4 #13:24\n`;
    text += `📄 RUT: 1054921764-4\n`;
    text += `------------------------\n`;
    text += `*Detalle de Venta*\n`;
    text += `Fecha: ${new Date().toLocaleString()}\n`;
    text += `Mesa: ${selectedMesa?.nombre || 'Mostrador'}\n`;
    text += `------------------------\n`;
    
    cart.forEach(item => {
      const subtotal = item.producto.precio * item.cantidad;
      text += `${item.cantidad}x ${item.producto.nombre} - $${subtotal.toLocaleString()}\n`;
    });
    
    text += `------------------------\n`;
    text += `*TOTAL: $${totalCart.toLocaleString()}*\n`;
    text += `------------------------\n`;
    text += `¡Gracias por su compra! 🍧`;

    let phone = clientPhone.replace(/\D/g, '');
    if (phone.length === 10) {
      phone = '57' + phone;
    }

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleProcessDirectPayment = async () => {
    if (!selectedMesa || cart.length === 0) return;

    const items = cart.map(item => {
      const selectedSabores = item.sabores?.filter(s => s).join(', ');
      const finalNotas = [selectedSabores, item.notas].filter(n => n).join(' | ');
      return { producto_id: item.producto.id, producto_nombre: item.producto.nombre, cantidad: item.cantidad, notas: finalNotas };
    });

    await processDirectPayment(selectedMesa.id, items, paymentMethod, selectedMesa.nombre);
    
    setCart([]);
    setSelectedMesa(null);
    setShowPaymentModal(false);
  };

  const handlePauseTimer = async (pedidoId: number) => {
    await pauseTimer(pedidoId);
  };

  const handleResumeTimer = async (pedidoId: number) => {
    await resumeTimer(pedidoId);
  };

  const getPedidoForMesa = (mesaId: number) => {
    return pedidosActivos.find(p => p.mesa_id === mesaId);
  };

  const handleBack = () => {
    if (selectedMesa && cart.length > 0) {
      saveDraftOrder(selectedMesa.id, []).catch(console.error);
    }
    setSelectedMesa(null);
    setCart([]);
  };

  const handleToggleSabor = async (id: number, currentState: boolean) => {
    await toggleSabor(id, currentState);
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
        <div className="flex flex-col lg:flex-row h-full bg-gray-50">
          {/* Left Panel - Menu */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-[50vh] lg:min-h-0">
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
                      onClick={() => handleToggleSabor(sabor.id, sabor.disponible)}
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
                      onClick={() => handleToggleSabor(sabor.id, sabor.disponible)}
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
                      onClick={() => handleToggleSabor(sabor.id, sabor.disponible)}
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
        <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-gray-200 flex flex-col flex-1 lg:flex-none min-h-[50vh] lg:min-h-0">
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
                        <button onClick={() => handlePauseTimer(pedidoActual.id)} className="p-1.5 bg-amber-100 text-amber-700 rounded hover:bg-amber-200" title="Pausar">
                          <Pause className="w-4 h-4" />
                        </button>
                      ) : (
                        <button onClick={() => handleResumeTimer(pedidoActual.id)} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200" title="Reanudar">
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-3">
                  {pedidoActual.items.map(item => (
                    <div key={item.id} className="flex flex-col gap-1 text-sm border-b border-gray-50 pb-2">
                      <div className="flex justify-between items-center">
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
                      {item.notas && (
                        <div className="text-xs text-gray-500 italic ml-6">
                          Nota: {item.notas}
                        </div>
                      )}
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
                    <div key={item.id} className="flex flex-col gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-900">{item.producto.nombre}</span>
                        <span className="font-semibold text-gray-900">${(item.producto.precio * item.cantidad).toLocaleString()}</span>
                      </div>
                      
                      {item.producto.categoria_id === 1 && (
                        <div className="flex gap-1 mt-1">
                          {[0, 1, 2].map(idx => (
                            <select
                              key={idx}
                              value={item.sabores?.[idx] || ''}
                              onChange={(e) => updateSabor(item.id, idx, e.target.value)}
                              className="w-1/3 text-[10px] p-1 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="">Sabor {idx + 1}</option>
                              {sabores.filter(s => s.tipo === 'helado' && s.disponible).map(s => (
                                <option key={s.id} value={s.nombre}>{s.nombre}</option>
                              ))}
                            </select>
                          ))}
                        </div>
                      )}

                      {item.producto.nombre.toLowerCase().includes('jugo') && (
                        <div className="flex gap-1 mt-1">
                          <select
                            value={item.sabores?.[0] || ''}
                            onChange={(e) => updateSabor(item.id, 0, e.target.value)}
                            className="w-full text-[10px] p-1 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="">Seleccionar Sabor de Jugo</option>
                            {sabores.filter(s => s.tipo === 'jugo' && s.disponible).map(s => (
                              <option key={s.id} value={s.nombre}>{s.nombre}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {item.producto.nombre.toLowerCase().includes('aromatica') && (
                        <div className="flex gap-1 mt-1">
                          <select
                            value={item.sabores?.[0] || ''}
                            onChange={(e) => updateSabor(item.id, 0, e.target.value)}
                            className="w-full text-[10px] p-1 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="">Seleccionar Sabor de Aromática</option>
                            {sabores.filter(s => s.tipo === 'aromatica' && s.disponible).map(s => (
                              <option key={s.id} value={s.nombre}>{s.nombre}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <input
                        type="text"
                        placeholder="Especificaciones (ej. sin salsa...)"
                        value={item.notas}
                        onChange={(e) => updateNotas(item.id, e.target.value)}
                        className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      />

                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-1">
                          <button onClick={() => updateQuantity(item.id, -1)} className="p-1 bg-gray-50 rounded hover:bg-gray-100"><Minus className="w-3 h-3" /></button>
                          <span className="font-medium w-4 text-center text-sm">{item.cantidad}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="p-1 bg-gray-50 rounded hover:bg-gray-100"><Plus className="w-3 h-3" /></button>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
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
                onClick={handleSubmitOrder}
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
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-colors shadow-sm ${
                          paymentMethod === method.id 
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold ring-2 ring-indigo-200' 
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="w-6 h-6" />
                        <span className="text-sm text-center">{method.id}</span>
                      </button>
                    );
                  })}
                </div>

              <h3 className="font-bold text-gray-700 mb-3 uppercase text-sm tracking-wider mt-4">Enviar Recibo (WhatsApp)</h3>
              <div className="flex gap-2 mb-6">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 font-bold">+57</span>
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="Número del cliente"
                    className="block w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <button
                  onClick={sendWhatsAppReceipt}
                  disabled={!clientPhone || clientPhone.length < 10}
                  className="px-4 py-3 bg-[#25D366] hover:bg-[#128C7E] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-md transition-colors flex items-center gap-2"
                >
                  <MessageCircle className="w-5 h-5" />
                </button>
              </div>

              <button
                onClick={handleProcessDirectPayment}
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
