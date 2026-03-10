import React, { useState, useEffect, useCallback } from 'react';
import { Pedido, Producto, Categoria } from '../types';
import { useSSE } from '../hooks/useSSE';
import { TimerDisplay } from './TimerDisplay';
import { CreditCard, DollarSign, Wallet, Building2, Receipt, X, Utensils, Pause, Play, TrendingUp, TrendingDown, Calendar, Package, Edit3, Plus, Minus, Trash2, CheckCircle2, XCircle, MessageCircle } from 'lucide-react';
import { 
  subscribeToPedidosActivos, 
  subscribeToProductos, 
  subscribeToDraftOrders, 
  subscribeToCategorias,
  subscribeToGastos,
  addGasto,
  saveProducto,
  deleteProducto,
  toggleProductoAvailability,
  processPayment,
  cancelOrderItem,
  pauseTimer,
  resumeTimer,
  getReportes
} from '../services/db';

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
  const [montoAPagar, setMontoAPagar] = useState<string>('');
  const [clientPhone, setClientPhone] = useState<string>('');
  const [splitMode, setSplitMode] = useState<boolean>(false);
  const [itemsToPay, setItemsToPay] = useState<Record<number, number>>({});
  const [itemToCancel, setItemToCancel] = useState<number | null>(null);
  const [productoToCancel, setProductoToCancel] = useState<number | null>(null);
  
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

  useEffect(() => {
    const unsubPedidos = subscribeToPedidosActivos(setPedidos);
    const unsubProd = subscribeToProductos(setProductos);
    const unsubDrafts = subscribeToDraftOrders(setDraftOrders);
    const unsubCat = subscribeToCategorias(setCategorias);

    return () => {
      unsubPedidos();
      unsubProd();
      unsubDrafts();
      unsubCat();
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'gastos') {
      const unsubGastos = subscribeToGastos(reporteFecha, setGastos);
      return () => unsubGastos();
    }
  }, [activeTab, reporteFecha]);

  const fetchReportes = useCallback(async () => {
    try {
      const { ventas, productos } = await getReportes(reporteFecha);
      setReporteVentas(ventas);
      setReporteProductos(productos);
    } catch (error) {
      console.error('Error fetching reportes:', error);
    }
  }, [reporteFecha]);

  useEffect(() => {
    if (activeTab === 'ventas') fetchReportes();
  }, [activeTab, reporteFecha, fetchReportes]);

  const handleAddGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGasto.descripcion || !newGasto.monto) return;

    await addGasto({
      ...newGasto,
      monto: parseFloat(newGasto.monto),
      fecha: reporteFecha
    });
    
    setNewGasto({ descripcion: '', categoria: 'insumos', monto: '' });
    if (activeTab === 'ventas') fetchReportes();
  };

  const handleSaveProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProducto) {
      await saveProducto(editingProducto);
      setEditingProducto(null);
    } else {
      if (!newProducto.nombre || !newProducto.precio) return;
      await saveProducto({
        ...newProducto,
        precio: parseFloat(newProducto.precio)
      });
      setNewProducto({ nombre: '', precio: '', categoria_id: 1, disponible: 1 });
    }
  };

  const handleDeleteProducto = (id: number) => {
    setProductoToCancel(id);
  };

  const confirmDeleteProducto = async () => {
    if (productoToCancel === null) return;
    
    try {
      await deleteProducto(productoToCancel);
    } catch (error: any) {
      alert(error.message);
    }
    setProductoToCancel(null);
  };

  const handleToggleProductAvailability = async (producto: Producto) => {
    await toggleProductoAvailability(producto.id, producto.disponible === 1);
  };

  const getProductPrice = (id: number) => {
    return productos.find(p => p.id === id)?.precio || 0;
  };

  const calculateTotal = (pedido: Pedido) => {
    return pedido.items.reduce((sum, item) => sum + (getProductPrice(item.producto_id) * item.cantidad), 0);
  };

  useEffect(() => {
    if (selectedPedido && !splitMode) {
      const total = calculateTotal(selectedPedido);
      const restante = total - (selectedPedido.pagado || 0);
      setMontoAPagar(restante.toString());
    }
  }, [selectedPedido, productos, splitMode]);

  useEffect(() => {
    if (splitMode && selectedPedido) {
      let sum = 0;
      Object.entries(itemsToPay).forEach(([id, cantidad]) => {
        const item = selectedPedido.items.find(i => i.id === parseInt(id));
        if (item) {
          sum += getProductPrice(item.producto_id) * (cantidad as number);
        }
      });
      setMontoAPagar(sum.toString());
    }
  }, [itemsToPay, splitMode, selectedPedido]);

  const sendWhatsAppReceipt = () => {
    if (!selectedPedido || !clientPhone) return;
    const total = calculateTotal(selectedPedido);
    
    let text = `🍦 *HELADERÍA ARCOIRIS* 🌈\n`;
    text += `📍 Carrera 4 #13:24\n`;
    text += `📄 RUT: 1054921764-4\n`;
    text += `------------------------\n`;
    text += `*Detalle de Venta*\n`;
    text += `Fecha: ${new Date().toLocaleString()}\n`;
    text += `Mesa: ${selectedPedido.mesa_numero}\n`;
    text += `------------------------\n`;
    
    selectedPedido.items.forEach(item => {
      const price = getProductPrice(item.producto_id);
      const subtotal = price * item.cantidad;
      text += `${item.cantidad}x ${item.producto_nombre} - $${subtotal.toLocaleString()}\n`;
    });
    
    text += `------------------------\n`;
    text += `*TOTAL: $${total.toLocaleString()}*\n`;
    if (selectedPedido.pagado > 0) {
      text += `Abonado: $${selectedPedido.pagado.toLocaleString()}\n`;
      text += `Restante: $${(total - selectedPedido.pagado).toLocaleString()}\n`;
    }
    text += `------------------------\n`;
    text += `¡Gracias por su compra! 🍧`;

    let phone = clientPhone.replace(/\D/g, '');
    if (phone.length === 10) {
      phone = '57' + phone;
    }

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handlePayment = async () => {
    if (!selectedPedido || !montoAPagar) return;
    
    const total = calculateTotal(selectedPedido);
    const monto = parseFloat(montoAPagar);
    
    if (isNaN(monto) || monto <= 0) return;

    const restante = total - (selectedPedido.pagado || 0);
    const cerrarMesa = monto >= restante;
    
    if (splitMode) {
      const itemsToPayArray = Object.entries(itemsToPay)
        .filter(([_, cantidad]) => (cantidad as number) > 0)
        .map(([id, cantidad]) => ({ id: parseInt(id), cantidad: cantidad as number }));

      await processPayment(selectedPedido.id, monto, paymentMethod, cerrarMesa, itemsToPayArray);
    } else {
      await processPayment(selectedPedido.id, monto, paymentMethod, cerrarMesa);
    }
    
    if (cerrarMesa) {
      setSelectedPedido(null);
      setSplitMode(false);
      setItemsToPay({});
    } else {
      // Reset split mode state
      setSplitMode(false);
      setItemsToPay({});
      // Update local selected pedido
      setSelectedPedido({
        ...selectedPedido,
        pagado: (selectedPedido.pagado || 0) + monto
      });
    }
  };

  const cancelItem = (itemId: number) => {
    setItemToCancel(itemId);
  };

  const confirmCancelItem = async () => {
    if (itemToCancel === null || !selectedPedido) return;
    
    await cancelOrderItem(selectedPedido.id, itemToCancel);
    
    // Update local state to reflect the change immediately
    const updatedItems = selectedPedido.items.filter(item => item.id !== itemToCancel);
    if (updatedItems.length === 0) {
      setSelectedPedido(null);
    } else {
      setSelectedPedido({ ...selectedPedido, items: updatedItems });
    }
    setItemToCancel(null);
  };

  const handlePauseTimer = async (pedidoId: number) => {
    await pauseTimer(pedidoId);
  };

  const handleResumeTimer = async (pedidoId: number) => {
    await resumeTimer(pedidoId);
  };

  const paymentMethods = [
    { id: 'Efectivo', icon: DollarSign },
    { id: 'Cuenta de Ahorros', icon: Building2 },
    { id: 'Nequi', icon: Wallet },
    { id: 'Daviplata', icon: Wallet },
  ];

  if (selectedPedido) {
    return (
      <div className="p-6 h-full flex flex-col bg-gray-50 max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden h-full relative">
          <div className="p-4 border-b border-gray-200 bg-gray-900 flex justify-between items-center relative z-10">
            <h2 className="text-xl font-bold text-white">Cobrar Mesa {selectedPedido.mesa_numero}</h2>
            <button onClick={() => setSelectedPedido(null)} className="p-2 text-gray-400 hover:text-white rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Factura Ticket */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 flex flex-col h-full">
                <div className="text-center mb-6 border-b border-gray-200/50 pb-4">
                  <h3 className="font-black text-xl text-gray-800">HELADERÍA ARCOIRIS</h3>
                  <p className="text-xs text-gray-600 font-medium">Carrera 4 #13:24</p>
                  <p className="text-xs text-gray-600 font-medium">RUT: 1054921764-4</p>
                  <p className="text-xs text-gray-500 mt-2">Pedido #{selectedPedido.id}</p>
                </div>

                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-700 uppercase text-sm tracking-wider">Detalle del Pedido</h3>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => {
                        setSplitMode(!splitMode);
                        setItemsToPay({});
                      }}
                      className={`text-xs px-3 py-1.5 rounded-full font-bold transition-colors ${
                        splitMode ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {splitMode ? 'Cancelar División' : 'Dividir por Productos'}
                    </button>
                    {selectedPedido.juego_minutos && selectedPedido.juego_minutos > 0 ? (
                      <div className="flex items-center gap-2">
                        <TimerDisplay 
                          inicio={selectedPedido.juego_inicio!} 
                          minutos={selectedPedido.juego_minutos} 
                          estado={selectedPedido.juego_estado as any}
                          restanteMs={selectedPedido.juego_restante_ms!}
                          className="text-sm bg-white/50 px-2 py-1 rounded-md shadow-sm"
                        />
                        {selectedPedido.juego_estado === 'activo' ? (
                          <button onClick={() => handlePauseTimer(selectedPedido.id)} className="p-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 shadow-sm" title="Pausar">
                            <Pause className="w-4 h-4" />
                          </button>
                        ) : (
                          <button onClick={() => handleResumeTimer(selectedPedido.id)} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200 shadow-sm" title="Reanudar">
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-3 mb-6 flex-1">
                  {selectedPedido.items.map(item => {
                    const unpaidCantidad = item.cantidad - (item.pagado_cantidad || 0);
                    const isFullyPaid = unpaidCantidad <= 0;
                    const selectedToPay = itemsToPay[item.id] || 0;

                    return (
                      <div key={item.id} className={`flex flex-col gap-1 text-sm border-b border-gray-200/50 pb-2 ${isFullyPaid ? 'opacity-50' : ''}`}>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            {splitMode && !isFullyPaid && (
                              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 mr-2">
                                <button
                                  onClick={() => setItemsToPay(prev => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] || 0) - 1) }))}
                                  className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 hover:text-indigo-600"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-4 text-center font-bold text-xs">{selectedToPay}</span>
                                <button
                                  onClick={() => setItemsToPay(prev => ({ ...prev, [item.id]: Math.min(unpaidCantidad, (prev[item.id] || 0) + 1) }))}
                                  className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 hover:text-indigo-600"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                            <span className="font-bold text-gray-900">{item.cantidad}x</span>
                            <span className="text-gray-800 font-medium">{item.producto_nombre}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            {item.pagado_cantidad && item.pagado_cantidad > 0 ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-green-100 text-green-800">
                                {item.pagado_cantidad}/{item.cantidad} Pagado
                              </span>
                            ) : (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shadow-sm ${
                                item.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                                item.estado === 'preparando' ? 'bg-blue-100 text-blue-800' :
                                item.estado === 'listo' ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {item.estado}
                              </span>
                            )}
                            <span className="font-bold text-gray-900 w-16 text-right">
                              ${(getProductPrice(item.producto_id) * item.cantidad).toLocaleString()}
                            </span>
                            {!isFullyPaid && !splitMode && (
                              <button
                                onClick={() => cancelItem(item.id)}
                                className="p-1 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                title="Cancelar producto"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        {item.notas && (
                          <div className="text-xs text-gray-600 italic ml-6">
                            Nota: {item.notas}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="border-t-2 border-dashed border-gray-300 pt-4 mt-auto">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-lg font-bold text-gray-700">Total del Pedido</span>
                    <span className="text-xl font-black text-gray-900">
                      ${calculateTotal(selectedPedido).toLocaleString()}
                    </span>
                  </div>
                  {selectedPedido.pagado > 0 && (
                    <div className="flex justify-between items-center mb-2 text-green-600">
                      <span className="text-md font-bold">Abonado</span>
                      <span className="text-lg font-bold">
                        -${selectedPedido.pagado.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200/50">
                    <span className="text-xl font-black text-gray-800">Restante</span>
                    <span className="text-3xl font-black text-indigo-600 drop-shadow-sm">
                      ${(calculateTotal(selectedPedido) - (selectedPedido.pagado || 0)).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Controls */}
              <div className="flex flex-col">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-6">
                  <h3 className="font-bold text-gray-800 mb-4 uppercase text-sm tracking-wider">Método de Pago</h3>
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

                  <h3 className="font-bold text-gray-800 mb-4 uppercase text-sm tracking-wider">Monto a Pagar</h3>
                  <div className="relative shadow-sm rounded-xl">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <DollarSign className="h-6 w-6 text-gray-400" />
                    </div>
                    <input
                      type="number"
                      value={montoAPagar}
                      onChange={(e) => setMontoAPagar(e.target.value)}
                      readOnly={splitMode}
                      className={`block w-full pl-12 pr-4 py-4 text-2xl font-bold text-gray-900 bg-white border-2 border-gray-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 ${splitMode ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      max={calculateTotal(selectedPedido) - (selectedPedido.pagado || 0)}
                    />
                  </div>
                  {!splitMode && (
                    <div className="mt-3 flex gap-2">
                      <button 
                        onClick={() => setMontoAPagar(((calculateTotal(selectedPedido) - (selectedPedido.pagado || 0)) / 2).toString())}
                        className="flex-1 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-bold text-sm transition-colors shadow-sm"
                      >
                        Mitad (50%)
                      </button>
                      <button 
                        onClick={() => setMontoAPagar((calculateTotal(selectedPedido) - (selectedPedido.pagado || 0)).toString())}
                        className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-sm transition-colors shadow-sm"
                      >
                        Total
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                  <h3 className="font-bold text-gray-800 mb-4 uppercase text-sm tracking-wider">Enviar Recibo (WhatsApp)</h3>
                  <div className="flex gap-2">
                    <div className="relative flex-1 shadow-sm rounded-xl">
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
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 bg-gray-50 relative z-10">
            <button
              onClick={handlePayment}
              disabled={!montoAPagar || parseFloat(montoAPagar) <= 0}
              className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-black text-xl shadow-lg transition-colors flex items-center justify-center gap-2"
            >
              <CreditCard className="w-6 h-6" />
              {splitMode 
                ? 'Pagar Productos Seleccionados'
                : parseFloat(montoAPagar) >= (calculateTotal(selectedPedido) - (selectedPedido.pagado || 0)) 
                  ? 'Confirmar Pago y Liberar Mesa' 
                  : 'Registrar Pago Parcial'}
            </button>
          </div>
        </div>

        {/* Confirmation Modal for Item Cancellation */}
        {itemToCancel !== null && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
              <h3 className="text-lg font-bold text-gray-900 mb-2">¿Cancelar Producto?</h3>
              <p className="text-gray-600 mb-6">
                ¿Estás seguro de que deseas eliminar este producto del pedido? Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setItemToCancel(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  Volver
                </button>
                <button
                  onClick={confirmCancelItem}
                  className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium transition-colors"
                >
                  Sí, cancelar producto
                </button>
              </div>
            </div>
          </div>
        )}
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
                    {pedido.pagado > 0 && (
                      <div className="absolute -bottom-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-white shadow-sm">
                        Abonado
                      </div>
                    )}
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
                                onClick={() => handleToggleProductAvailability(prod)}
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

      {/* Confirmation Modal for Producto Deletion */}
      {productoToCancel !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">¿Eliminar Producto?</h3>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setProductoToCancel(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                Volver
              </button>
              <button
                onClick={confirmDeleteProducto}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium transition-colors"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
