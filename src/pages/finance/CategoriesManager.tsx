import { useState } from "react";
import { useCategories } from "@/hooks/useFinance";
import { Category } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tag, Plus, Edit2, Check, Sparkles, X, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function CategoriesManager() {
  const { categories, isLoading, addCategory, updateCategory, deleteCategory } = useCategories();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [newKeyword, setNewKeyword] = useState("");

  const handleOpenAdd = () => {
    setEditingCategory({
      name: "",
      type: "expense",
      color: "#3b82f6",
      icon: "Tag",
      keywords: [],
      aliases: [],
      sort_order: categories.length + 1,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory({ ...cat });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingCategory?.name?.trim()) {
      toast.error("Ingresa un nombre de categoría");
      return;
    }

    if (editingCategory.id) {
      await updateCategory.mutateAsync({
        id: editingCategory.id,
        updates: editingCategory,
      });
    } else {
      await addCategory.mutateAsync(editingCategory);
    }
    setModalOpen(false);
  };

  const handleAddKeyword = () => {
    if (!newKeyword.trim() || !editingCategory) return;
    const kw = newKeyword.trim().toLowerCase();
    if (!editingCategory.keywords?.includes(kw)) {
      setEditingCategory({
        ...editingCategory,
        keywords: [...(editingCategory.keywords || []), kw],
      });
    }
    setNewKeyword("");
  };

  const handleRemoveKeyword = (kw: string) => {
    if (!editingCategory) return;
    setEditingCategory({
      ...editingCategory,
      keywords: (editingCategory.keywords || []).filter((k) => k !== kw),
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 md:pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black font-serif tracking-tight text-foreground">
            Gestor de Categorías
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Administra tus categorías personales, colores, iconos y palabras clave para auto-clasificación.
          </p>
        </div>

        <Button
          onClick={handleOpenAdd}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          <span>Nueva Categoría</span>
        </Button>
      </div>

      {/* Grid of Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="flex flex-col justify-between p-4 rounded-2xl border bg-card hover:border-primary/40 transition-colors shadow-sm space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-white"
                  style={{ backgroundColor: cat.color || "#3b82f6" }}
                >
                  <Tag className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">{cat.name}</h3>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">
                    {cat.type} {cat.is_system ? "· Sistema" : ""}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => handleOpenEdit(cat)}
                  title="Editar categoría"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                {!cat.is_system && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (window.confirm(`¿Eliminar la categoría '${cat.name}'?`)) {
                        deleteCategory.mutate(cat.id);
                      }
                    }}
                    title="Eliminar categoría"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Keywords Pills */}
            <div className="flex flex-wrap gap-1">
              {(cat.keywords || []).slice(0, 5).map((kw) => (
                <span
                  key={kw}
                  className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
                >
                  {kw}
                </span>
              ))}
              {(cat.keywords || []).length > 5 && (
                <span className="text-[10px] text-muted-foreground self-center">
                  +{(cat.keywords || []).length - 5}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Edit/Create Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-primary">
              {editingCategory?.id ? "Editar Categoría" : "Nueva Categoría"}
            </DialogTitle>
          </DialogHeader>

          {editingCategory && (
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nombre</label>
                <Input
                  value={editingCategory.name || ""}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  placeholder="Ej: Food, Tech, Cursos..."
                  className="mt-1 font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                  <select
                    value={editingCategory.type || "expense"}
                    onChange={(e) => setEditingCategory({ ...editingCategory, type: e.target.value as any })}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                  >
                    <option value="expense">Gasto</option>
                    <option value="income">Ingreso</option>
                    <option value="investment">Inversión</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Color (HEX)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={editingCategory.color || "#3b82f6"}
                      onChange={(e) => setEditingCategory({ ...editingCategory, color: e.target.value })}
                      className="h-8 w-10 cursor-pointer rounded border"
                    />
                    <Input
                      value={editingCategory.color || "#3b82f6"}
                      onChange={(e) => setEditingCategory({ ...editingCategory, color: e.target.value })}
                      className="font-mono text-xs h-8"
                    />
                  </div>
                </div>
              </div>

              {/* Keywords / Aliases manager */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Palabras Clave de Auto-Clasificación (Keywords)
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddKeyword();
                      }
                    }}
                    placeholder="Ej: carrefour, coto, supermercado..."
                    className="font-mono text-xs"
                  />
                  <Button size="sm" onClick={handleAddKeyword} className="h-9">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-2 max-h-28 overflow-y-auto">
                  {(editingCategory.keywords || []).map((kw) => (
                    <span
                      key={kw}
                      className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-mono"
                    >
                      <span>{kw}</span>
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                        onClick={() => handleRemoveKeyword(kw)}
                      />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button className="bg-primary text-primary-foreground" onClick={handleSave}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
