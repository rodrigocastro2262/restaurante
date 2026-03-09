import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Pedido } from '../types';
import { useSSE } from '../hooks/useSSE';
import { Clock, ChefHat, CheckCircle2, Volume2, VolumeX, Edit3 } from 'lucide-react';

interface DraftOrder {
  mesa_id: number;
  items: { producto_id: number; producto_nombre: string; cantidad: number }[];
  updated_at: number;
}

const WaitTimer = ({ creadoEn }: { creadoEn: string }) => {
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    const calculateTime = () => {
      // SQLite CURRENT_TIMESTAMP is in UTC format 'YYYY-MM-DD HH:MM:SS'
      const utcDateStr = creadoEn.replace(' ', 'T') + 'Z';
      const created = new Date(utcDateStr).getTime();
      const now = Date.now();
      const diffMins = Math.floor((now - created) / 60000);
      setMinutes(diffMins >= 0 ? diffMins : 0);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [creadoEn]);

  const isLate = minutes >= 15;

  return (
    <span className={`text-xs font-bold flex items-center gap-1 px-2 py-1 rounded-full shadow-sm ${
      isLate ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-800 text-gray-300'
    }`}>
      <Clock className="w-3 h-3" />
      {minutes} min esperando
    </span>
  );
};

export default function CocinaView() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [draftOrders, setDraftOrders] = useState<DraftOrder[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [announcedTimers, setAnnouncedTimers] = useState<Set<number>>(new Set());
  const [knownItemIds, setKnownItemIds] = useState<Set<number>>(new Set());
  const isInitialLoad = useRef(true);

  const fetchPedidos = useCallback(async () => {
    try {
      const [pedidosRes, draftRes] = await Promise.all([
        fetch('/api/pedidos/activos'),
        fetch('/api/pedidos/draft')
      ]);
      
      if (pedidosRes.ok) setPedidos(await pedidosRes.json());
      if (draftRes.ok) setDraftOrders(await draftRes.json());
    } catch (error) {
      console.error('Error fetching pedidos:', error);
    }
  }, []);

  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  useSSE('/api/events', fetchPedidos);

  const enableAudio = () => {
    setAudioEnabled(true);
    const msg = new SpeechSynthesisUtterance("Sonidos de cocina activados");
    msg.lang = 'es-ES';
    window.speechSynthesis.speak(msg);
  };

  // Check for new orders
  useEffect(() => {
    if (pedidos.length === 0 && isInitialLoad.current) return;
    
    if (isInitialLoad.current) {
      const initialIds = new Set<number>();
      pedidos.forEach(p => p.items.forEach(i => initialIds.add(i.id)));
      setKnownItemIds(initialIds);
      isInitialLoad.current = false;
      return;
    }

    let hasNew = false;
    const currentIds = new Set(knownItemIds);
    
    pedidos.forEach(p => {
      p.items.forEach(i => {
        if (!knownItemIds.has(i.id)) {
          hasNew = true;
          currentIds.add(i.id);
        }
      });
    });

    if (hasNew) {
      setKnownItemIds(currentIds);
      if (audioEnabled) {
        const audio = new Audio('https://actions.google.com/sounds/v1/doors/front_door_chime.ogg');
        audio.play().catch(e => console.log('Audio play failed:', e));
        
        setTimeout(() => {
          const msg = new SpeechSynthesisUtterance("Nuevo pedido en cocina");
          msg.lang = 'es-ES';
          window.speechSynthesis.speak(msg);
        }, 1500);
      }
    }
  }, [pedidos, audioEnabled, knownItemIds]);

  // Check for expired timers
  useEffect(() => {
    if (!audioEnabled) return;

    const interval = setInterval(() => {
      pedidos.forEach(pedido => {
        if (pedido.juego_minutos && pedido.juego_minutos > 0) {
          let diff = 0;
          if (pedido.juego_estado === 'pausado') {
            diff = pedido.juego_restante_ms || 0;
          } else if (pedido.juego_inicio) {
            const start = new Date(pedido.juego_inicio).getTime();
            const end = start + pedido.juego_minutos * 60000;
            const now = Date.now();
            diff = end - now;
          }

          if (diff <= 0 && !announcedTimers.has(pedido.id)) {
            setAnnouncedTimers(prev => new Set(prev).add(pedido.id));
            
            const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
            audio.play().catch(e => console.log('Audio play failed:', e));

            setTimeout(() => {
              const msg = new SpeechSynthesisUtterance(`Mesa ${pedido.mesa_numero} terminó el tiempo`);
              msg.lang = 'es-ES';
              window.speechSynthesis.speak(msg);
            }, 1000);
          }
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pedidos, announcedTimers, audioEnabled]);

  const updateItemStatus = async (itemId: number, newStatus: string) => {
    await fetch(`/api/pedido_items/${itemId}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: newStatus })
    });
  };

  const mesasActivas = pedidos.filter(p => p.items.some(i => i.estado !== 'entregado'));

  return (
    <div className="p-6 h-full overflow-y-auto bg-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ChefHat className="w-8 h-8 text-gray-900" />
          <h1 className="text-3xl font-bold text-gray-900">KDS - Cocina (Por Mesa)</h1>
        </div>
        <button
          onClick={() => setAudioEnabled(!audioEnabled)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-colors ${
            audioEnabled 
              ? 'bg-green-100 text-green-700 border-2 border-green-200' 
              : 'bg-red-100 text-red-700 border-2 border-red-200 animate-pulse'
          }`}
        >
          {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          {audioEnabled ? 'Sonidos Activados' : 'Activar Sonidos'}
        </button>
      </div>

      {mesasActivas.length === 0 && draftOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
          <CheckCircle2 className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-xl font-medium">No hay pedidos pendientes en cocina</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
          {draftOrders.map(draft => (
            <div key={`draft-${draft.mesa_id}`} className="bg-white rounded-2xl shadow-sm border-2 border-indigo-300 overflow-hidden flex flex-col relative opacity-80">
              <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 animate-pulse"></div>
              <div className="bg-indigo-50 text-indigo-900 p-4 flex justify-between items-center border-b border-indigo-100">
                <h2 className="text-2xl font-black flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-indigo-500" />
                  Mesa {draft.mesa_id}
                </h2>
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 bg-indigo-200 text-indigo-800 rounded-full">
                  Tomando Pedido...
                </span>
              </div>
              <div className="p-4 flex-1 flex flex-col gap-3 bg-indigo-50/30">
                {draft.items.map((item, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-xl border border-indigo-100 flex flex-col gap-2 shadow-sm">
                    <div className="flex items-start gap-2">
                      <span className="font-black text-lg text-indigo-900">{item.cantidad}x</span>
                      <span className="text-gray-800 font-medium leading-tight pt-1">{item.producto_nombre}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {mesasActivas.map(pedido => (
            <div key={pedido.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
                <h2 className="text-2xl font-black">Mesa {pedido.mesa_numero}</h2>
                <WaitTimer creadoEn={pedido.creado_en} />
              </div>
              <div className="p-4 flex-1 flex flex-col gap-3 bg-gray-50">
                {pedido.items.filter(i => i.estado !== 'entregado').map(item => (
                  <div key={item.id} className="bg-white p-3 rounded-xl border border-gray-200 flex flex-col gap-2 shadow-sm">
                    <div className="flex items-start gap-2">
                      <span className="font-black text-lg text-gray-900">{item.cantidad}x</span>
                      <span className="text-gray-800 font-medium leading-tight pt-1">{item.producto_nombre}</span>
                    </div>
                    <div className="flex justify-end mt-1">
                      <select 
                        value={item.estado}
                        onChange={(e) => updateItemStatus(item.id, e.target.value)}
                        className={`text-sm font-bold rounded-lg px-3 py-1.5 border-0 cursor-pointer outline-none ring-2 ring-transparent focus:ring-indigo-500 transition-all ${
                          item.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                          item.estado === 'preparando' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}
                      >
                        <option value="pendiente">En Espera</option>
                        <option value="preparando">Preparando</option>
                        <option value="listo">Listo</option>
                        <option value="entregado">Entregado</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
