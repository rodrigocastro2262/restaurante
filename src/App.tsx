import React, { useState } from 'react';
import MeseroView from './components/MeseroView';
import CocinaView from './components/CocinaView';
import AdminView from './components/AdminView';
import { Utensils, ChefHat, Receipt } from 'lucide-react';

type View = 'mesero' | 'cocina' | 'admin';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('mesero');

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-100 font-sans overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="bg-gray-900 text-white shadow-md z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <Utensils className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Restaurante POS</span>
          </div>
          
          <nav className="flex gap-1 bg-gray-800 p-1 rounded-xl">
            <button
              onClick={() => setCurrentView('mesero')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'mesero' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Utensils className="w-4 h-4" />
              Mesero
            </button>
            <button
              onClick={() => setCurrentView('cocina')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'cocina' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <ChefHat className="w-4 h-4" />
              Cocina (KDS)
            </button>
            <button
              onClick={() => setCurrentView('admin')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'admin' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Receipt className="w-4 h-4" />
              Caja / Admin
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {currentView === 'mesero' && <MeseroView />}
        {currentView === 'cocina' && <CocinaView />}
        {currentView === 'admin' && <AdminView />}
      </main>
    </div>
  );
}
