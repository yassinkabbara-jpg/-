import React, { useState, useEffect } from 'react';
import { ShoppingCart, Package, Plus, Trash2, CheckCircle, QrCode, LogOut, LayoutDashboard, Store, Search, Lock, Eye, EyeOff, Pencil } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { io } from 'socket.io-client';
import { Category, Product, Order, CartItem } from './types';

const socket = io();

// --- Components ---

const Navbar = ({ role, user, onLogout, onLoginClick, onMyOrdersClick }: { 
  role: 'merchant' | 'customer' | 'landing', 
  user?: { username: string, role: string } | null,
  onLogout?: () => void, 
  onLoginClick?: () => void,
  onMyOrdersClick?: () => void
}) => (
  <nav className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex justify-between items-center">
    <div className="flex items-center gap-2">
      <div className="bg-emerald-600 p-1.5 rounded-lg">
        <Store className="text-white w-5 h-5" />
      </div>
      <span className="text-xl font-bold text-gray-900">سَعرك</span>
    </div>
    <div className="flex items-center gap-2">
      {user && user.role === 'customer' && (
        <button 
          onClick={onMyOrdersClick}
          className="text-emerald-600 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-emerald-50 transition-colors"
        >
          طلباتي
        </button>
      )}
      {user ? (
        <button onClick={onLogout} className="text-gray-500 hover:text-red-600 transition-colors p-2 flex items-center gap-1">
          <span className="text-xs font-medium hidden sm:inline">تسجيل الخروج</span>
          <LogOut className="w-5 h-5" />
        </button>
      ) : (
        <button 
          onClick={onLoginClick} 
          className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-transform"
        >
          تسجيل الدخول
        </button>
      )}
    </div>
  </nav>
);

// --- Merchant Dashboard ---

const MerchantDashboard = ({ user, onLogout }: { user: any, onLogout: () => void }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [rate, setRate] = useState(15000);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showUpdateRate, setShowUpdateRate] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [newOrderNotify, setNewOrderNotify] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'products'>('orders');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
    socket.on('new_order', (order) => {
      setOrders(prev => [order, ...prev]);
      setNewOrderNotify(true);
      setTimeout(() => setNewOrderNotify(false), 5000);
    });
    socket.on('rate_updated', (data) => setRate(data.rate));
    return () => {
      socket.off('new_order');
      socket.off('rate_updated');
    };
  }, []);

  const fetchData = async () => {
    const [pRes, cRes, oRes, rRes] = await Promise.all([
      fetch('/api/products'),
      fetch('/api/categories'),
      fetch('/api/orders'),
      fetch('/api/rate')
    ]);
    setProducts(await pRes.json());
    setCategories(await cRes.json());
    setOrders(await oRes.json());
    const rateData = await rRes.json();
    setRate(rateData.rate);
  };

  const handleSaveProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    const imageFile = formData.get('image') as File;
    
    let imageUrl = editingProduct?.image_url || '';
    if (imageFile && imageFile.size > 0) {
      imageUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(imageFile);
      });
    }

    const payload = {
      name: data.name,
      description: data.description,
      category_id: parseInt(data.category_id as string),
      usd_price: parseFloat(data.usd_price as string),
      image_url: imageUrl
    };

    let res;
    if (editingProduct) {
      res = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    if (res.ok) {
      setShowAddProduct(false);
      setEditingProduct(null);
      fetchData();
    } else {
      const err = await res.json();
      alert(err.error || 'حدث خطأ أثناء حفظ المنتج');
    }
  };

  const handleDeleteProduct = async () => {
    if (productToDelete) {
      const res = await fetch(`/api/products/${productToDelete}`, { method: 'DELETE' });
      if (res.ok) {
        setProductToDelete(null);
        fetchData();
      } else {
        alert('حدث خطأ أثناء حذف المنتج');
      }
    }
  };

  const handleAddCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = new FormData(e.currentTarget).get('name');
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (res.ok) {
      setShowAddCategory(false);
      fetchData();
    } else {
      const err = await res.json();
      alert(err.error || 'حدث خطأ أثناء إضافة التصنيف');
    }
  };

  const markDelivered = async (id: number) => {
    const res = await fetch(`/api/orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' })
    });
    if (res.ok) fetchData();
  };

  const handleUpdateRate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const newRate = new FormData(e.currentTarget).get('rate');
    const res = await fetch('/api/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rate: newRate })
    });
    if (res.ok) {
      setShowUpdateRate(false);
      fetchData();
    } else {
      const err = await res.json();
      alert(err.error || 'حدث خطأ أثناء تحديث سعر الصرف');
    }
  };

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const oldPassword = formData.get('oldPassword');
    const newPassword = formData.get('newPassword');

    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword, newPassword })
    });

    if (res.ok) {
      alert('تم تغيير كلمة المرور بنجاح');
      setShowChangePassword(false);
    } else {
      const data = await res.json();
      alert(data.error || 'حدث خطأ ما');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navbar role="merchant" user={user} onLogout={onLogout} />
      
      {newOrderNotify && (
        <div className="fixed top-20 left-4 right-4 bg-emerald-600 text-white p-4 rounded-xl shadow-lg z-50 animate-bounce flex items-center justify-between">
          <span>وصلك طلب جديد! 🚀</span>
          <button onClick={() => setNewOrderNotify(false)}>إغلاق</button>
        </div>
      )}

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Stats & Rate */}
        <div className="grid grid-cols-2 gap-4">
          <div 
            onClick={() => setShowUpdateRate(true)}
            className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:border-emerald-500 transition-colors group"
          >
            <p className="text-gray-500 text-sm group-hover:text-emerald-600">سعر الصرف الحالي (تعديل)</p>
            <p className="text-2xl font-bold text-emerald-600">{rate.toLocaleString()} ل.س</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">إجمالي الطلبات</p>
            <p className="text-2xl font-bold text-blue-600">{orders.length}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          <button onClick={() => setShowAddProduct(true)} className="flex-shrink-0 bg-emerald-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm">
            <Plus className="w-4 h-4" /> إضافة منتج
          </button>
          <button onClick={() => setShowAddCategory(true)} className="flex-shrink-0 bg-white text-gray-700 px-4 py-2 rounded-xl border border-gray-200 flex items-center gap-2 shadow-sm">
            <Plus className="w-4 h-4" /> إضافة تصنيف
          </button>
          <button onClick={() => setShowQR(true)} className="flex-shrink-0 bg-white text-gray-700 px-4 py-2 rounded-xl border border-gray-200 flex items-center gap-2 shadow-sm">
            <QrCode className="w-4 h-4" /> كود المتجر
          </button>
          <button onClick={() => setShowChangePassword(true)} className="flex-shrink-0 bg-white text-gray-700 px-4 py-2 rounded-xl border border-gray-200 flex items-center gap-2 shadow-sm">
            <Lock className="w-4 h-4" /> تغيير كلمة السر
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100">
          <button 
            onClick={() => setActiveTab('orders')}
            className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'orders' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Package className="w-5 h-5" /> الطلبات الواردة
          </button>
          <button 
            onClick={() => setActiveTab('products')}
            className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'products' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <ShoppingCart className="w-5 h-5" /> المنتجات المضافة
          </button>
        </div>

        {/* Orders Section */}
        {activeTab === 'orders' && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-4">
              {orders.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl text-center text-gray-400 border border-dashed border-gray-200">
                  لا يوجد طلبات حالياً
                </div>
              ) : (
                orders.map(order => (
                  <div key={order.id} className={`p-4 rounded-2xl shadow-sm border transition-all ${
                    order.status === 'completed' 
                      ? 'bg-gray-50 border-gray-200 opacity-75 grayscale-[0.5]' 
                      : 'bg-white border-emerald-100 ring-1 ring-emerald-500/10'
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-gray-900">{order.customer_name}</h3>
                          {order.status === 'completed' && (
                            <span className="bg-gray-200 text-gray-600 text-[10px] px-2 py-0.5 rounded-full font-bold">تم التسليم</span>
                          )}
                          {order.status === 'pending' && (
                            <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">جديد</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{order.phone}</p>
                      </div>
                      <span className="text-emerald-600 font-bold">{(order.total_syp).toLocaleString()} ل.س</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{order.address}</p>
                    
                    {/* Ordered Items */}
                    <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">المنتجات المطلوبة</p>
                      {(() => {
                        try {
                          const items = JSON.parse(order.items) as CartItem[];
                          return items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 bg-white rounded flex items-center justify-center text-[10px] font-bold border border-gray-100">{item.quantity}</span>
                                <span className="text-gray-700 font-medium">{item.name}</span>
                              </div>
                              <span className="text-gray-400 text-xs">{(item.usd_price * rate).toLocaleString()} ل.س</span>
                            </div>
                          ));
                        } catch (e) {
                          return <p className="text-xs text-red-400">خطأ في عرض المنتجات</p>;
                        }
                      })()}
                    </div>

                    <div className="flex gap-2">
                      {order.status !== 'completed' && (
                        <button onClick={() => markDelivered(order.id)} className="flex-1 bg-emerald-50 text-emerald-600 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1">
                          <CheckCircle className="w-4 h-4" /> تم التسليم
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* Products Section */}
        {activeTab === 'products' && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {products.length === 0 ? (
                <div className="col-span-full bg-white p-8 rounded-2xl text-center text-gray-400 border border-dashed border-gray-200">
                  لا يوجد منتجات مضافة حالياً
                </div>
              ) : (
                products.map(product => (
                  <div key={product.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex gap-4">
                    <div className="w-20 h-20 bg-gray-50 rounded-xl overflow-hidden flex-shrink-0">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Package className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{product.name}</h3>
                      <p className="text-xs text-gray-500 line-clamp-1 mb-2">{product.description}</p>
                      <div className="flex justify-between items-center">
                        <span className="text-emerald-600 font-bold text-sm">{(product.usd_price * rate).toLocaleString()} ل.س</span>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setEditingProduct(product);
                              setShowAddProduct(true);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setProductToDelete(product.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </main>

      {/* Modals */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 animate-in slide-in-from-bottom duration-300">
            <h3 className="text-xl font-bold mb-4">{editingProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h3>
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <input name="name" defaultValue={editingProduct?.name} placeholder="اسم المنتج" required className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-emerald-500" />
              <textarea name="description" defaultValue={editingProduct?.description} placeholder="الوصف" className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-emerald-500" />
              <select name="category_id" defaultValue={editingProduct?.category_id} required className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-emerald-500">
                <option value="">اختر التصنيف</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="flex gap-2">
                <input name="usd_price" type="number" step="0.01" defaultValue={editingProduct?.usd_price} placeholder="السعر بالدولار ($)" required className="flex-1 p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-emerald-500" />
                <div className="flex-1 p-3 bg-gray-100 rounded-xl text-gray-500 text-center flex items-center justify-center text-sm">
                   السعر بالليرة حسب صرفك اليدوي
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 mr-2">صورة المنتج {editingProduct && '(اتركه فارغاً للحفاظ على الصورة الحالية)'}</label>
                <input 
                  name="image" 
                  type="file" 
                  accept="image/*" 
                  className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-emerald-500 text-sm" 
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => {
                  setShowAddProduct(false);
                  setEditingProduct(null);
                }} className="flex-1 py-3 text-gray-500 font-medium">إلغاء</button>
                <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold">حفظ المنتج</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddCategory && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xs rounded-3xl p-6">
            <h3 className="text-lg font-bold mb-4">إضافة تصنيف</h3>
            <form onSubmit={handleAddCategory} className="space-y-4">
              <input name="name" placeholder="اسم التصنيف" required className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-emerald-500" />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAddCategory(false)} className="flex-1 text-gray-500">إلغاء</button>
                <button type="submit" className="flex-1 bg-emerald-600 text-white py-2 rounded-xl font-bold">إضافة</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUpdateRate && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xs rounded-3xl p-6">
            <h3 className="text-lg font-bold mb-4">تعديل سعر الصرف</h3>
            <form onSubmit={handleUpdateRate} className="space-y-4">
              <input 
                name="rate" 
                type="number" 
                defaultValue={rate} 
                placeholder="سعر الصرف الجديد" 
                required 
                className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-emerald-500" 
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowUpdateRate(false)} className="flex-1 text-gray-500">إلغاء</button>
                <button type="submit" className="flex-1 bg-emerald-600 text-white py-2 rounded-xl font-bold">تحديث</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showQR && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setShowQR(false)}>
          <div className="bg-white p-8 rounded-3xl text-center space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold">كود المتجر الخاص بك</h3>
            <div className="bg-gray-50 p-4 rounded-2xl inline-block">
              <QRCodeSVG value={`${window.location.origin}/catalog`} size={200} />
            </div>
            <p className="text-sm text-gray-500">قم بطباعة هذا الكود ليتمكن الزبائن من تصفح متجرك</p>
            <button onClick={() => setShowQR(false)} className="w-full py-3 bg-gray-100 rounded-xl font-bold">إغلاق</button>
          </div>
        </div>
      )}

      {showChangePassword && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xs rounded-3xl p-6">
            <h3 className="text-lg font-bold mb-4">تغيير كلمة السر</h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="relative">
                <input 
                  name="oldPassword" 
                  type={showPasswords ? "text" : "password"} 
                  placeholder="كلمة السر القديمة" 
                  required 
                  className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-emerald-500" 
                />
                <button 
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="relative">
                <input 
                  name="newPassword" 
                  type={showPasswords ? "text" : "password"} 
                  placeholder="كلمة السر الجديدة" 
                  required 
                  className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-emerald-500" 
                />
                <button 
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowChangePassword(false)} className="flex-1 text-gray-500">إلغاء</button>
                <button type="submit" className="flex-1 bg-emerald-600 text-white py-2 rounded-xl font-bold">تغيير</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {productToDelete && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xs rounded-3xl p-6 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold mb-2">حذف المنتج</h3>
            <p className="text-gray-500 text-sm mb-6">هل أنت متأكد من حذف هذا المنتج نهائياً؟ لا يمكن التراجع عن هذه العملية.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setProductToDelete(null)} 
                className="flex-1 py-3 text-gray-500 font-medium"
              >
                إلغاء
              </button>
              <button 
                onClick={handleDeleteProduct} 
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold"
              >
                حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Components ---

const MyOrdersModal = ({ username, onClose, rate }: { username: string, onClose: () => void, rate: number }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/customer/orders/${username}`)
      .then(res => res.json())
      .then(data => {
        setOrders(data);
        setLoading(false);
      });
  }, [username]);

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold">طلباتي السابقة</h3>
          <button onClick={onClose} className="text-gray-400">إغلاق</button>
        </div>
        <div className="space-y-6">
          {loading ? (
            <p className="text-center text-gray-400 py-10">جاري التحميل...</p>
          ) : orders.length === 0 ? (
            <p className="text-center text-gray-400 py-10">لا يوجد طلبات سابقة</p>
          ) : (
            orders.map(order => (
              <div key={order.id} className="border-b pb-4 last:border-0">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-bold text-sm">طلب #{order.id}</p>
                    <p className="text-[10px] text-gray-400">{new Date(order.created_at).toLocaleDateString('ar-SY')}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${
                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    order.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {order.status === 'pending' ? 'قيد الانتظار' : order.status === 'completed' ? 'تم التسليم' : 'ملغي'}
                  </span>
                </div>
                <div className="space-y-1">
                  {(() => {
                    try {
                      return JSON.parse(order.items).map((item: any, idx: number) => (
                        <p key={idx} className="text-xs text-gray-600">• {item.name} ({item.quantity})</p>
                      ));
                    } catch (e) {
                      return <p className="text-xs text-red-400">خطأ في عرض المنتجات</p>;
                    }
                  })()}
                </div>
                <p className="mt-2 font-bold text-emerald-600 text-sm">الإجمالي: {order.total_syp.toLocaleString()} ل.س</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// --- Customer View ---

const CustomerView = ({ user, onLogout, onLoginClick }: { 
  user: any, 
  onLogout: () => void,
  onLoginClick: () => void 
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [rate, setRate] = useState(15000);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMyOrders, setShowMyOrders] = useState(false);

  useEffect(() => {
    fetch('/api/products').then(res => res.json()).then(setProducts);
    fetch('/api/rate').then(res => res.json()).then(data => setRate(data.rate));

    socket.on('rate_updated', (data) => setRate(data.rate));
    return () => {
      socket.off('rate_updated');
    };
  }, []);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const totalSYP = cart.reduce((sum, item) => sum + (item.usd_price * rate * item.quantity), 0);

  const handleCheckout = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const orderData = {
      customer_id: user?.id,
      customer_name: formData.get('customer_name'),
      phone: formData.get('phone'),
      address: formData.get('address'),
      items: cart,
      total_syp: totalSYP
    };

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });

    if (res.ok) {
      setCart([]);
      setShowCheckout(false);
      setOrderSuccess(true);
      setTimeout(() => setOrderSuccess(false), 5000);
    } else {
      alert('حدث خطأ أثناء إرسال الطلب');
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const groupedProducts = filteredProducts.reduce((acc: any[], product) => {
    const catId = product.category_id;
    const catName = product.category_name || 'غير مصنف';
    const existing = acc.find(c => c.id === catId);
    if (existing) {
      existing.products.push(product);
    } else {
      acc.push({ id: catId, name: catName, products: [product] });
    }
    return acc;
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navbar 
        role="customer" 
        user={user} 
        onLogout={onLogout} 
        onLoginClick={onLoginClick} 
        onMyOrdersClick={() => setShowMyOrders(true)}
      />
      
      <main className="max-w-md mx-auto">
        {/* Header */}
        <section className="bg-emerald-600 text-white p-8 rounded-b-[3rem] shadow-lg mb-8">
          <h1 className="text-3xl font-black mb-2">تسوّق الآن</h1>
          <p className="text-emerald-100 text-sm mb-6">اطلب منتجاتك المفضلة بأفضل الأسعار</p>
          
          {/* Search Bar */}
          <div className="relative group">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-200 w-5 h-5 group-focus-within:text-white transition-colors" />
            <input 
              type="text" 
              placeholder="ابحث عن منتج..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-12 pl-4 py-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-sm focus:ring-2 focus:ring-white focus:border-transparent outline-none transition-all text-white placeholder:text-emerald-200"
            />
          </div>
        </section>

        {/* Products Grouped by Category */}
        <div className="px-4 space-y-12">
          {groupedProducts.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>لا يوجد منتجات متوفرة حالياً</p>
            </div>
          ) : (
            groupedProducts.map(category => (
              <section key={category.id}>
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2 px-2">
                  <div className="w-1.5 h-6 bg-emerald-600 rounded-full"></div>
                  {category.name}
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  {category.products.map(product => (
                    <div key={product.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col">
                      <div className="aspect-square bg-gray-50 relative">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <Package className="w-8 h-8" />
                          </div>
                        )}
                      </div>
                      <div className="p-3 flex-1 flex flex-col">
                        <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{product.name}</h3>
                        <p className="text-[10px] text-gray-500 mt-1 line-clamp-2 flex-1">{product.description}</p>
                        <div className="mt-3 flex flex-col gap-2">
                          <span className="text-emerald-600 font-bold text-sm">{(product.usd_price * rate).toLocaleString()} ل.س</span>
                          {user && user.role === 'customer' && (
                            <button 
                              onClick={() => addToCart(product)}
                              className="w-full bg-emerald-600 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform"
                            >
                              <Plus className="w-3 h-3" /> أضف للسلة
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </main>

      {/* Cart Button */}
      {cart.length > 0 && (
        <div className="fixed bottom-6 left-4 right-4 z-50 max-w-md mx-auto">
          <button 
            onClick={() => setShowCart(true)}
            className="w-full bg-emerald-600 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between animate-in fade-in slide-in-from-bottom-4"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg relative">
                <ShoppingCart className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-[10px] w-4 h-4 rounded-full flex items-center justify-center border-2 border-emerald-600">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              </div>
              <span className="font-bold">عرض السلة</span>
            </div>
            <span className="font-bold">{totalSYP.toLocaleString()} ل.س</span>
          </button>
        </div>
      )}

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">سلة المشتريات</h3>
              <button onClick={() => setShowCart(false)} className="text-gray-400">إغلاق</button>
            </div>
            <div className="space-y-4 mb-8">
              {cart.map(item => (
                <div key={item.id} className="flex gap-4 items-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                    {item.image_url && <img src={item.image_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-sm">{item.name}</h4>
                    <p className="text-xs text-gray-500">{item.quantity} × {(item.usd_price * rate).toLocaleString()} ل.س</p>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="text-red-500 p-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="border-t pt-4 space-y-4">
              <div className="flex justify-between font-bold text-lg">
                <span>الإجمالي</span>
                <span className="text-emerald-600">{totalSYP.toLocaleString()} ل.س</span>
              </div>
              <p className="text-[10px] text-gray-400 text-center italic">
                * السعر لا يشمل رسوم التوصيل
              </p>
              <button 
                onClick={() => { setShowCart(false); setShowCheckout(true); }}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg"
              >
                تأكيد الطلب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6">
            <h3 className="text-xl font-bold mb-6">معلومات التوصيل</h3>
            <form onSubmit={handleCheckout} className="space-y-4">
              <input name="customer_name" placeholder="الاسم الكامل" required className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500" />
              <input name="phone" type="tel" placeholder="رقم الهاتف" required className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500" />
              <textarea name="address" placeholder="العنوان بالتفصيل" required className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 h-32" />
              <p className="text-xs text-gray-500 text-center bg-gray-50 py-2 rounded-lg border border-dashed border-gray-200">
                * ملاحظة: السعر المعروض هو ثمن المنتجات فقط (بدون رسوم التوصيل)
              </p>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCheckout(false)} className="flex-1 py-4 text-gray-500 font-medium">إلغاء</button>
                <button type="submit" className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold">إرسال الطلب</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {orderSuccess && (
        <div className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
          <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-12 h-12 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">تم استلام طلبك!</h2>
          <p className="text-gray-500 mb-8">شكراً لثقتك بنا. سنتواصل معك قريباً لتأكيد الطلب.</p>
          <button onClick={() => setOrderSuccess(false)} className="w-full max-w-xs py-4 bg-emerald-600 text-white rounded-2xl font-bold">العودة للمتجر</button>
        </div>
      )}

      {showMyOrders && user && (
        <MyOrdersModal username={user.username} onClose={() => setShowMyOrders(false)} rate={rate} />
      )}
    </div>
  );
};

// --- Landing & Auth ---

const LandingPage = ({ user, onLogin, onLogout }: { user: any, onLogin: (user: any) => void, onLogout: () => void }) => {
  const [showLogin, setShowLogin] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rate, setRate] = useState(15000);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetch('/api/products').then(res => res.json()).then(setProducts);
    fetch('/api/categories').then(res => res.json()).then(setCategories);
    fetch('/api/rate').then(res => res.json()).then(data => setRate(data.rate));

    socket.on('rate_updated', (data) => setRate(data.rate));
    return () => {
      socket.off('rate_updated');
    };
  }, []);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const totalSYP = cart.reduce((sum, item) => sum + (item.usd_price * rate * item.quantity), 0);

  const handleCheckout = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        items: cart,
        total_syp: totalSYP,
        customer_id: user?.id
      })
    });
    
    if (res.ok) {
      setCart([]);
      setShowCheckout(false);
      setOrderSuccess(true);
      setTimeout(() => setOrderSuccess(false), 5000);
    } else {
      alert('حدث خطأ أثناء إرسال الطلب');
    }
  };

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username');
    const password = formData.get('password');
    
    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (res.ok) {
      const userData = await res.json();
      onLogin(userData);
      setShowLogin(false);
    } else {
      const err = await res.json();
      alert(err.error || 'حدث خطأ ما');
    }
  };

  // Filter products based on search query
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Group products by category
  const groupedProducts = filteredProducts.reduce((acc: any[], product) => {
    const catId = product.category_id;
    const catName = product.category_name || 'غير مصنف';
    const existing = acc.find(c => c.id === catId);
    if (existing) {
      existing.products.push(product);
    } else {
      acc.push({ id: catId, name: catName, products: [product] });
    }
    return acc;
  }, []);

  return (
    <div className="min-h-screen bg-white pb-24">
      <Navbar 
        role={user ? user.role : "landing"} 
        user={user}
        onLoginClick={() => setShowLogin(true)} 
        onLogout={onLogout}
        onMyOrdersClick={() => setShowMyOrders(true)}
      />
      
      <main className="max-w-4xl mx-auto">
        <section className="px-6 py-16 text-center">
          <div className="mb-8">
            <div className="w-20 h-20 bg-emerald-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg rotate-3">
              <Store className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-extrabold text-gray-900 mb-4">سَعرك</h1>
            <p className="text-lg text-gray-600 leading-relaxed max-w-xl mx-auto">
              المنصة السورية الأولى لإدارة الكتالوجات الرقمية بذكاء. 
              تصفح منتجاتنا بأسعار دقيقة ومحدثة.
            </p>
          </div>

          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 inline-block px-8 mb-8">
            <p className="text-emerald-800 font-medium text-sm">
              سعر الصرف الحالي: {rate.toLocaleString()} ل.س
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-md mx-auto px-4 mb-4">
            <div className="relative group">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 group-focus-within:text-emerald-600 transition-colors" />
              <input 
                type="text" 
                placeholder="ابحث عن منتج..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-12 pl-4 py-4 bg-white rounded-2xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-gray-900"
              />
            </div>
          </div>
        </section>

        {/* Products Grouped by Category */}
        <div className="px-4 space-y-12">
          {groupedProducts.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>لا يوجد منتجات متوفرة حالياً</p>
            </div>
          ) : (
            groupedProducts.map(category => (
              <section key={category.id}>
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2 px-2">
                  <div className="w-1.5 h-6 bg-emerald-600 rounded-full"></div>
                  {category.name}
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  {category.products.map(product => (
                    <div key={product.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col">
                      <div className="aspect-square bg-gray-50 relative">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <Package className="w-8 h-8" />
                          </div>
                        )}
                      </div>
                      <div className="p-3 flex-1 flex flex-col">
                        <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{product.name}</h3>
                        <p className="text-[10px] text-gray-500 mt-1 line-clamp-2 flex-1">{product.description}</p>
                        <div className="mt-3 flex flex-col gap-2">
                          <span className="text-emerald-600 font-bold text-sm">{(product.usd_price * rate).toLocaleString()} ل.س</span>
                          {user && user.role === 'customer' && (
                            <button 
                              onClick={() => addToCart(product)}
                              className="w-full bg-emerald-600 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform"
                            >
                              <Plus className="w-3 h-3" /> أضف للسلة
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </main>

      {/* Cart Button */}
      {cart.length > 0 && (
        <div className="fixed bottom-6 left-4 right-4 z-50 max-w-md mx-auto">
          <button 
            onClick={() => setShowCart(true)}
            className="w-full bg-emerald-600 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between animate-in fade-in slide-in-from-bottom-4"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg relative">
                <ShoppingCart className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-[10px] w-4 h-4 rounded-full flex items-center justify-center border-2 border-emerald-600">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              </div>
              <span className="font-bold">عرض السلة</span>
            </div>
            <span className="font-bold">{totalSYP.toLocaleString()} ل.س</span>
          </button>
        </div>
      )}

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">سلة المشتريات</h3>
              <button onClick={() => setShowCart(false)} className="text-gray-400">إغلاق</button>
            </div>
            <div className="space-y-4 mb-8">
              {cart.map(item => (
                <div key={item.id} className="flex gap-4 items-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                    {item.image_url && <img src={item.image_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-sm">{item.name}</h4>
                    <p className="text-xs text-gray-500">{item.quantity} × {(item.usd_price * rate).toLocaleString()} ل.س</p>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="text-red-500 p-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="border-t pt-4 space-y-4">
              <div className="flex justify-between font-bold text-lg">
                <span>الإجمالي</span>
                <span className="text-emerald-600">{totalSYP.toLocaleString()} ل.س</span>
              </div>
              <p className="text-[10px] text-gray-400 text-center italic">
                * السعر لا يشمل رسوم التوصيل
              </p>
              <button 
                onClick={() => { setShowCart(false); setShowCheckout(true); }}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg"
              >
                تأكيد الطلب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6">
            <h3 className="text-xl font-bold mb-6">معلومات التوصيل</h3>
            <form onSubmit={handleCheckout} className="space-y-4">
              <input name="customer_name" placeholder="الاسم الكامل" required className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500" />
              <input name="phone" type="tel" placeholder="رقم الهاتف" required className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500" />
              <textarea name="address" placeholder="العنوان بالتفصيل" required className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 h-32" />
              <p className="text-xs text-gray-500 text-center bg-gray-50 py-2 rounded-lg border border-dashed border-gray-200">
                * ملاحظة: السعر المعروض هو ثمن المنتجات فقط (بدون رسوم التوصيل)
              </p>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCheckout(false)} className="flex-1 py-4 text-gray-500 font-medium">إلغاء</button>
                <button type="submit" className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold">إرسال الطلب</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {orderSuccess && (
        <div className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
          <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-12 h-12 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">تم استلام طلبك!</h2>
          <p className="text-gray-500 mb-8">شكراً لثقتك بنا. سنتواصل معك قريباً لتأكيد الطلب.</p>
          <button onClick={() => setOrderSuccess(false)} className="w-full max-w-xs py-4 bg-emerald-600 text-white rounded-2xl font-bold">العودة للمتجر</button>
        </div>
      )}

      {showLogin && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xs rounded-3xl p-8 shadow-2xl">
            <h3 className="text-2xl font-bold mb-6 text-center">{isRegistering ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}</h3>
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 mr-2">اسم المستخدم</label>
                <input name="username" type="text" required className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 mr-2">كلمة المرور</label>
                <div className="relative">
                  <input 
                    name="password" 
                    type={showPassword ? "text" : "password"} 
                    required 
                    className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg mt-4">
                {isRegistering ? 'إنشاء حساب' : 'دخول'}
              </button>
              <button 
                type="button" 
                onClick={() => setIsRegistering(!isRegistering)} 
                className="w-full py-2 text-emerald-600 text-sm font-bold"
              >
                {isRegistering ? 'لديك حساب؟ سجل دخول' : 'ليس لديك حساب؟ أنشئ حساباً جديداً'}
              </button>
              <button type="button" onClick={() => setShowLogin(false)} className="w-full py-2 text-gray-400 text-sm">إلغاء</button>
            </form>
          </div>
        </div>
      )}

      {showMyOrders && user && (
        <MyOrdersModal username={user.username} onClose={() => setShowMyOrders(false)} rate={rate} />
      )}
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [view, setView] = useState<'landing' | 'dashboard' | 'catalog'>('landing');
  const [user, setUser] = useState<{ id: number, username: string, role: 'merchant' | 'customer' } | null>(null);

  // Simple routing based on path
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/catalog') setView('catalog');
  }, []);

  const handleLogout = () => {
    setUser(null);
    if (view === 'dashboard') setView('landing');
  };

  if (view === 'catalog') return (
    <CustomerView 
      user={user} 
      onLogout={handleLogout} 
      onLoginClick={() => setView('landing')} 
    />
  );

  if (user?.role === 'merchant') return <MerchantDashboard user={user} onLogout={handleLogout} />;
  
  return (
    <LandingPage 
      user={user}
      onLogin={(userData) => {
        setUser(userData);
        if (userData.role === 'merchant') setView('dashboard');
      }} 
      onLogout={handleLogout}
    />
  );
}
