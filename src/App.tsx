import React, { useState } from 'react';
import MeseroView from './components/MeseroView';
import CocinaView from './components/CocinaView';
import AdminView from './components/AdminView';
import { Utensils, ChefHat, Receipt, LogOut, Lock, X } from 'lucide-react';

type View = 'mesero' | 'cocina' | 'admin';
type Role = 'admin' | 'mesero' | null;

export default function App() {
  const [role, setRole] = useState<Role>(null);
  const [currentView, setCurrentView] = useState<View>('mesero');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple password check (can be changed later or moved to backend)
    if (adminPassword === 'admin123') {
      setRole('admin');
      setCurrentView('admin');
      setShowAdminLogin(false);
      setAdminPassword('');
      setLoginError('');
    } else {
      setLoginError('Contraseña incorrecta');
    }
  };

  if (!role) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-100 font-sans relative">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full border border-gray-100">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-6">
              <Utensils className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-center text-gray-900 mb-2 tracking-tight">Restaurante POS</h1>
          <p className="text-center text-gray-500 mb-8 text-sm">Selecciona tu rol para ingresar</p>
          <div className="space-y-4">
            <button
              onClick={() => { setRole('mesero'); setCurrentView('mesero'); }}
              className="w-full py-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-3 border border-indigo-200"
            >
              <Utensils className="w-6 h-6" />
              Ingresar como Mesero
            </button>
            <button
              onClick={() => setShowAdminLogin(true)}
              className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-3 shadow-md"
            >
              <Receipt className="w-6 h-6" />
              Ingresar como Admin
            </button>
          </div>
        </div>

        {/* Admin Login Modal */}
        {showAdminLogin && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="bg-gray-900 p-6 text-white flex justify-between items-center">
                <h2 className="text-2xl font-black flex items-center gap-2">
                  <Lock className="w-6 h-6 text-indigo-400" />
                  Acceso Administrador
                </h2>
                <button 
                  onClick={() => {
                    setShowAdminLogin(false);
                    setAdminPassword('');
                    setLoginError('');
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6">
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Contraseña</label>
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-lg"
                      placeholder="••••••••"
                      autoFocus
                    />
                    {loginError && (
                      <p className="text-red-500 text-sm font-bold mt-2">{loginError}</p>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg transition-colors shadow-md"
                  >
                    Ingresar
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

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
            <span className="ml-2 px-2 py-0.5 bg-gray-800 text-xs font-medium rounded-full text-gray-300 uppercase tracking-wider">
              {role}
            </span>
          </div>
          
          <div className="flex items-center gap-4">
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
              {role === 'admin' && (
                <button
                  onClick={() => setCurrentView('admin')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentView === 'admin' ? 'bg-indigo-500 text-white shadow-sm' : 'text-gray-300 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <Receipt className="w-4 h-4" />
                  Caja / Admin
                </button>
              )}
            </nav>
            
            <button
              onClick={() => { setRole(null); setCurrentView('mesero'); }}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {currentView === 'mesero' && <MeseroView />}
        {currentView === 'cocina' && <CocinaView />}
        {currentView === 'admin' && role === 'admin' && <AdminView />}
      </main>
    </div>
  );
}
