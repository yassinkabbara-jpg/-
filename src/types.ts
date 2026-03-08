export interface Category {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  category_id: number;
  category_name?: string;
  usd_price: number;
  image_url: string;
}

export interface Order {
  id: number;
  customer_name: string;
  address: string;
  phone: string;
  items: string; // JSON string
  total_syp: number;
  status: 'pending' | 'completed';
  created_at: string;
}

export interface CartItem extends Product {
  quantity: number;
}
