import React, { useState, useEffect } from 'react';
import { Tag, Edit2, Check, X, Search } from 'lucide-react';
import { Card, Button, Input } from '../../components';

interface Category {
    id: number;
    name: string;
}

const CategoryManager: React.FC = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchCategories = async () => {
        try {
            const res = await (window as any).go.main.App.GetCategories();
            setCategories(res || []);
            setLoading(false);
        } catch (e) {
            console.error('Failed to fetch categories', e);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleStartEdit = (category: Category) => {
        setEditingId(category.id);
        setEditName(category.name);
    };

    const handleSaveEdit = async () => {
        if (!editingId) return;
        try {
            await (window as any).go.main.App.RenameCategory(editingId, editName);
            setEditingId(null);
            fetchCategories();
        } catch (e) {
            console.error('Failed to rename category', e);
        }
    };

    const filteredCategories = categories.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="min-h-screen pt-24 pb-12 px-8 bg-canvas-100 texture-delight">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand/10 text-brand rounded-2xl shadow-brand/5 shadow-inner">
                            <Tag className="w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-canvas-800">Categories</h1>
                            <p className="text-canvas-500 font-medium">Manage and rename your transaction categories</p>
                        </div>
                    </div>

                    <div className="relative w-64 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-canvas-400 group-focus-within:text-brand transition-colors" />
                        <input
                            type="text"
                            placeholder="Search categories..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-canvas-200 rounded-xl text-sm focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/5 transition-all shadow-sm"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20 text-canvas-400">Loading categories...</div>
                ) : filteredCategories.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-canvas-200">
                        <Tag className="w-12 h-12 text-canvas-200 mx-auto mb-4" />
                        <p className="text-canvas-500 font-bold">No categories found matching "{search}"</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredCategories.map((category) => (
                            <Card
                                key={category.id}
                                variant="glass"
                                className={`p-4 group transition-all duration-300 ${editingId === category.id ? 'ring-2 ring-brand border-brand shadow-brand-glow' : 'hover:shadow-lg hover:border-canvas-300'}`}
                            >
                                <div className="flex items-center justify-between">
                                    {editingId === category.id ? (
                                        <div className="flex-1 flex gap-2">
                                            <input
                                                autoFocus
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                                                className="flex-1 bg-white border border-brand/30 rounded-lg px-3 py-1.5 font-bold text-canvas-800 focus:outline-none focus:ring-2 ring-brand/10"
                                            />
                                            <button onClick={handleSaveEdit} className="p-2 bg-brand text-white rounded-lg hover:bg-brand-600 transition-colors">
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setEditingId(null)} className="p-2 bg-canvas-200 text-canvas-600 rounded-lg hover:bg-canvas-300 transition-colors">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-canvas-100 flex items-center justify-center text-canvas-400 group-hover:bg-brand/5 group-hover:text-brand transition-colors">
                                                    <Tag className="w-5 h-5" />
                                                </div>
                                                <span className="font-bold text-canvas-700 text-lg group-hover:text-canvas-900 transition-colors">{category.name}</span>
                                            </div>
                                            <button
                                                onClick={() => handleStartEdit(category)}
                                                className="p-2 opacity-0 group-hover:opacity-100 text-canvas-400 hover:text-brand hover:bg-brand/5 rounded-lg transition-all"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CategoryManager;
