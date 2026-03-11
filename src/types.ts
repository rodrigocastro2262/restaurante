export interface Mesa {
  id: number;
  numero: number;
  nombre: string;
  estado: 'disponible' | 'ocupada';
}

export interface Categoria {
  id: number;
  nombre: string;
}

export interface Producto {
  id: number;
  categoria_id: number;
  nombre: string;
  precio: number;
  disponible: number; // 0 or 1
}

export interface Sabor {
  id: number;
  nombre: string;
  tipo: 'helado' | 'jugo' | 'aromatica';
  disponible: boolean;
}

export interface PedidoItem {
  id: number;
  pedido_id: number;
  producto_id: number;
  producto_nombre: string;
  cantidad: number;
  estado: 'pendiente' | 'preparando' | 'listo' | 'entregado';
  notas?: string;
  sabores?: string[];
  pagado_cantidad?: number;
}

export interface Pedido {
  id: number;
  mesa_id: number;
  mesa_numero: string;
  estado: 'abierto' | 'pagado';
  creado_en: string;
  juego_minutos: number | null;
  juego_inicio: string | null;
  juego_estado: 'activo' | 'pausado' | null;
  juego_restante_ms: number | null;
  pagado: number;
  items: PedidoItem[];
}
