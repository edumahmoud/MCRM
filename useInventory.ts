
import { useState, useEffect, useCallback } from 'react';
import { Product } from '../types';
import { supabase } from '../supabaseClient';

export const useInventory = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name');
    
    if (!error && data) {
      const mapped: Product[] = data.map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description || '',
        wholesalePrice: Number(p.wholesale_price || 0),
        retailPrice: Number(p.retail_price || 0),
        stock: Number(p.stock || 0),
        isDeleted: p.is_deleted,
        deletionReason: p.deletion_reason,
        deletionTimestamp: p.deletion_timestamp
      }));
      setProducts(mapped);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts();
    
    const subscription = supabase
      .channel('products-all-changes')
      .on('postgres_changes', { event: '*', table: 'products' }, () => {
        fetchProducts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [fetchProducts]);

  const addProduct = async (name: string, description: string, wholesale: number, retail: number, initialStock: number) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const payload = {
      code,
      name: name.trim(),
      description: description?.trim() || '',
      wholesale_price: Number(wholesale || 0),
      retail_price: Number(retail || 0),
      stock: Number(initialStock || 0)
    };

    const { data, error } = await supabase
      .from('products')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const updateProduct = async (productId: string, updates: Partial<Product>) => {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.retailPrice !== undefined) dbUpdates.retail_price = Number(updates.retailPrice);
    if (updates.stock !== undefined) dbUpdates.stock = Number(updates.stock);
    if (updates.wholesalePrice !== undefined) dbUpdates.wholesale_price = Number(updates.wholesalePrice);

    const { error } = await supabase
      .from('products')
      .update(dbUpdates)
      .eq('id', productId);
    
    if (error) throw error;
  };

  const deleteProduct = async (productId: string, reason: string) => {
    const { error } = await supabase
      .from('products')
      .update({ 
        is_deleted: true, 
        deletion_reason: reason, 
        deletion_timestamp: Date.now() 
      })
      .eq('id', productId);
    if (error) throw error;
  };

  const deductStock = async (productId: string, qty: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const newStock = Math.max(0, product.stock - qty);
    await supabase.from('products').update({ stock: newStock }).eq('id', productId);
  };

  return { products, loading, addProduct, updateProduct, deleteProduct, deductStock, refresh: fetchProducts };
};
