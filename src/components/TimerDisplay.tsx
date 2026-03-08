import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export function TimerDisplay({ 
  inicio, 
  minutos, 
  estado = 'activo',
  restanteMs = 0,
  className = "" 
}: { 
  inicio: string, 
  minutos: number, 
  estado?: 'activo' | 'pausado',
  restanteMs?: number,
  className?: string 
}) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      let diff = 0;
      if (estado === 'pausado') {
        diff = restanteMs;
      } else {
        const start = new Date(inicio).getTime();
        const end = start + minutos * 60000;
        const now = Date.now();
        diff = end - now;
      }

      if (diff <= 0) {
        setTimeLeft('00:00');
        setIsExpired(true);
      } else {
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        setIsExpired(false);
      }
    };

    updateTimer();
    if (estado === 'activo') {
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [inicio, minutos, estado, restanteMs]);

  return (
    <div className={`font-mono font-bold flex items-center gap-1 ${isExpired ? 'text-red-600 animate-pulse' : estado === 'pausado' ? 'text-amber-500' : 'text-blue-600'} ${className}`}>
      <Clock className="w-4 h-4" />
      {timeLeft}
      {estado === 'pausado' && <span className="text-[10px] uppercase ml-1">Pausa</span>}
    </div>
  );
}
