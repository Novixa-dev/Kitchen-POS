import { Button, Input, Autosearch } from '../../../components/atoms';
import React, { useState, useEffect } from 'react';
import { MenuItem, InventoryItem, RecipeItem } from '../../../types/models';
import { api } from '../../../lib/ipc';
import { useToast } from '../../../hooks/useToast';
import { useI18n } from '../../../i18n/useI18n';

interface Props {
  item: MenuItem;
  onClose: () => void;
}

const RecipeModal: React.FC<Props> = ({ item, onClose }) => {
  const { t, formatNumber } = useI18n();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const { showToast } = useToast();
  
  // New item form
  const [selectedInvId, setSelectedInvId] = useState<number | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [qtyUsed, setQtyUsed] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [invRes, recipeRes] = await Promise.all([
          api.inventory.getAll(),
          api.menu.getRecipe({ menu_item_id: item.id })
        ]);
        
        if (invRes.success && invRes.data) {
          setInventory(invRes.data);
        }
        if (recipeRes.success && recipeRes.data) {
          setRecipeItems(recipeRes.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    void fetchData();
  }, [item.id]);

  const handleAddIngredient = () => {
    if (!selectedInvId || !qtyUsed) {
      return;
    }
    
    const invId = selectedInvId;
    const qty = parseFloat(qtyUsed);
    
    if (isNaN(qty) || qty <= 0) {
      return;
    }
    
    // Check if already in recipe
    if (recipeItems.some(ri => ri.inventory_item_id === invId)) {
      showToast({ message: t('menu.ingredientAlreadyAdded'), variant: 'error' });
      return;
    }
    
    const invItem = inventory.find(i => i.id === invId);
    if (!invItem) {
      return;
    }
    
    setRecipeItems([
      ...recipeItems, 
      { 
        inventory_item_id: invId, 
        qty_used: qty,
        name: invItem.name,
        unit: invItem.unit
      }
    ]);
    
    setSelectedInvId('');
    setQtyUsed('');
    setSearchQuery('');
  };

  const handleRemoveIngredient = (invId: number) => {
    setRecipeItems(recipeItems.filter(ri => ri.inventory_item_id !== invId));
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    try {
      const res = await api.menu.updateRecipe({
        menu_item_id: item.id,
        ingredients: recipeItems.map(ri => ({
          inventory_item_id: ri.inventory_item_id,
          qty_used: ri.qty_used
        }))
      });
      
      if (res.success) {
        showToast({ message: t('menu.recipeSaved'), variant: 'success' });
        onClose();
      } else {
        showToast({ message: res.error ?? t('menu.recipeSaveFailed'), variant: 'error' });
      }
    } catch (err) {
      console.error(err);
      showToast({ message: t('toast.unexpectedError'), variant: 'error' });
    }
  };

  return (
    <>
      {loading ? (
        <div className="p-8 text-center text-subtle">{t('menu.loadingRecipe')}</div>
      ) : (
        <form id="recipe-form" onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          
          {/* Ingredients List */}
          <div>
            <h3 className="text-sm font-bold text-body mb-3">{t('menu.currentIngredients')}</h3>
            {recipeItems.length === 0 ? (
              <div className="text-sm text-subtle p-4 border border-line rounded-control bg-surface-muted text-center">
                {t('menu.noIngredients')}
              </div>
            ) : (
              <div className="space-y-2">
                {recipeItems.map(ri => (
                  <div key={ri.inventory_item_id} className="flex justify-between items-center gap-2 p-3 border border-line rounded-control bg-surface">
                    <div>
                      <span className="font-semibold text-body">{ri.name}</span>
                      <span className="text-sm text-subtle ms-2 tabular">({formatNumber(ri.qty_used)} {ri.unit})</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-danger hover:bg-danger-subtle"
                      onClick={() => { handleRemoveIngredient(ri.inventory_item_id); }}
                      type="button"
                    >
                      {t('action.remove')}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Add New Ingredient */}
          <div className="border-t border-line pt-4">
            <h3 className="text-sm font-bold text-body mb-3">{t('menu.addIngredient')}</h3>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Autosearch 
                  label={t('menu.inventoryItem')}
                  options={inventory.map(inv => ({ value: String(inv.id), label: `${inv.name} (${inv.unit})` }))}
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onSelectOption={(opt) => {
                    setSelectedInvId(Number(opt.value));
                    setSearchQuery(opt.label);
                  }}
                  placeholder={t('menu.searchInventory')}
                />
              </div>
              <div className="w-24">
                <Input 
                  label={t('label.qtyShort')}
                  type="number"
                  min="0"
                  step="0.001"
                  value={qtyUsed}
                  onChange={(e) => { setQtyUsed(e.target.value); }}
                  placeholder="0.5"
                />
              </div>
              <Button 
                variant="outline" 
                type="button" 
                onClick={() => { handleAddIngredient(); }}
                disabled={!selectedInvId || !qtyUsed}
              >
                {t('action.add')}
              </Button>
            </div>
          </div>

        </form>
      )}
    </>
  );
};

export default RecipeModal;
