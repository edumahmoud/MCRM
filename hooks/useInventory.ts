
import { useState, useEffect, useCallback } from 'react';
import { Product, User } from '../types';
import { supabase } from '../supabaseClient';

const isUUID = (id: any) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const SYSTEM_ADMIN_ID = '00000000-0000-0000-0000-000000000000';

export const useInventory = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name')
      .limit(2000);
    
    if (!error && data) {
      setProducts(data.map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description,
        wholesalePrice: Number(p.wholesale_price || 0),
        retailPrice: Number(p.retail_price || 0),
        stock: Number(p.stock || 0),
        lowStockThreshold: Number(p.low_stock_threshold || 3),
        isDeleted: p.is_deleted,
        deletionReason: p.deletion_reason,
        deletionTimestamp: p.deletion_timestamp,
        deletedBy: p.deleted_by,
        branchId: p.branch_id
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts();
    const sub = supabase.channel('inv').on('postgres_changes', {event:'*', table:'products'}, () => fetchProducts()).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchProducts]);

  const addProduct = async (name: string, description: string, wholesalePrice: number, retailPrice: number, stock: number, user: User) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    const { data, error } = await supabase
      .from('products')
      .insert([{
        name,
        description,
        wholesale_price: Number(wholesalePrice),
        retail_price: Number(retailPrice),
        stock: Number(stock),
        code, 
        low_stock_threshold: 3,
        branch_id: user.branchId || null
      }])
      .select()
      .single();
    
    if (error) throw error;

    // Mapping raw database result to Product type for the UI with robust checks
    const mappedProduct: Product = {
      id: data.id,
      code: data.code,
      name: data.name,
      description: data.description,
      wholesalePrice: Number(data.wholesale_price || 0),
      retailPrice: Number(data.retail_price || 0),
      stock: Number(data.stock || 0),
      lowStockThreshold: Number(data.low_stock_threshold || 3),
      branchId: data.branch_id
    };

    await supabase.rpc('log_system_action', {
      p_user_id: user.id,
      p_username: user.username,
      p_action: 'INSERT',
      p_entity_type: 'product',
      p_entity_id: data.id,
      p_details: `إضافة صنف جديد للفرع: ${name} برصيد ${stock}`,
      p_new: data
    });

    await fetchProducts();
    return mappedProduct;
  };

  const updateProduct = async (id: string, updates: Partial<Product>, user: User) => {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.wholesalePrice !== undefined) dbUpdates.wholesale_price = updates.wholesalePrice;
    if (updates.retailPrice !== undefined) dbUpdates.retail_price = updates.retailPrice;
    if (updates.stock !== undefined) dbUpdates.stock = updates.stock;
    if (updates.lowStockThreshold !== undefined) dbUpdates.low_stock_threshold = updates.lowStockThreshold;

    const { error } = await supabase.from('products').update(dbUpdates).eq('id', id);
    if (error) throw error;

    await fetchProducts();
  };

  const deleteProduct = async (id: string, reason: string, user: User) => {
    const product = products.find(p => p.id === id);
    if (!product) return;

    const validUserId = (user.id === SYSTEM_ADMIN_ID || !isUUID(user.id)) ? null : user.id;

    const { error: updateError } = await supabase
      .from('products')
      .update({ 
        is_deleted: true, 
        deletion_reason: reason, 
        deletion_timestamp: Date.now(),
        deleted_by: validUserId
      })
      .eq('id', id);
    
    if (updateError) throw updateError;
    await fetchProducts();
  };

  const deductStock = async (id: string, qty: number) => {
    const { error } = await supabase.rpc('deduct_product_stock', {
      p_id: id,
      p_qty: qty
    });
    if (error) console.error("Atomic deduct error:", error);
    await fetchProducts();
  };

  return { products, loading, refresh: fetchProducts, deductStock, addProduct, updateProduct, deleteProduct };
};
