// src/components/admin/CategoryManager.tsx
import React, { useState, useEffect } from 'react';
import { Tag, Plus, Edit, Trash2 } from 'lucide-react';
import { manageCategory, getCategories } from '../../lib/supabase';

export function CategoryManager() {
  const [categories, setCategories] = useState<any[]>([]);
  const [newCategory, setNewCategory] = useState({ name: '', slug: '', parentId: '' });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }

  async function handleSaveCategory() {
    try {
      if (editingId) {
        await manageCategory('update', {
          id: editingId,
          name: newCategory.name,
          slug: newCategory.slug,
          parentId: newCategory.parentId || undefined,
        });
        setEditingId(null);
      } else {
        await manageCategory('create', {
          name: newCategory.name,
          slug: newCategory.slug,
          parentId: newCategory.parentId || undefined,
        });
      }
      setNewCategory({ name: '', slug: '', parentId: '' });
      fetchCategories();
    } catch (error) {
      console.error('Error saving category:', error);
    }
  }

  async function handleDeleteCategory(id: string) {
    try {
      await manageCategory('delete', { id, name: '', slug: '' });
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  }

  function startEditing(category: any) {
    setEditingId(category.id);
    setNewCategory({
      name: category.name,
      slug: category.slug,
      parentId: category.parent_id || '',
    });
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-4">Category Management</h2>

      {/* Category Form */}
      <div className="mb-6 flex gap-4">
        <input
          type="text"
          placeholder="Category name"
          value={newCategory.name}
          onChange={e => setNewCategory({ ...newCategory, name: e.target.value })}
          className="flex-1 p-2 border rounded"
        />
        <input
          type="text"
          placeholder="Slug"
          value={newCategory.slug}
          onChange={e => setNewCategory({ ...newCategory, slug: e.target.value })}
          className="flex-1 p-2 border rounded"
        />
        <select
          value={newCategory.parentId}
          onChange={e => setNewCategory({ ...newCategory, parentId: e.target.value })}
          className="p-2 border rounded"
        >
          <option value="">No Parent</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button
          onClick={handleSaveCategory}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg"
        >
          {editingId ? 'Update' : 'Create'}
        </button>
      </div>

      {/* Categories List */}
      <div className="space-y-2">
        {categories.map(category => (
          <div key={category.id} className="flex items-center justify-between border-b py-2">
            <div className="flex items-center gap-2">
              <Tag size={16} />
              <span>{category.name} ({category.slug})</span>
              {category.parent_id && (
                <span className="text-sm text-gray-500">
                  → {categories.find(c => c.id === category.parent_id)?.name}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => startEditing(category)}
                className="text-indigo-600 hover:text-indigo-800"
              >
                <Edit size={16} />
              </button>
              <button
                onClick={() => handleDeleteCategory(category.id)}
                className="text-red-600 hover:text-red-800"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}