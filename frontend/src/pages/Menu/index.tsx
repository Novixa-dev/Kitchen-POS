import { Button, Select } from '../../components/atoms';
import React, { useState, useEffect } from 'react';
import { api } from '../../lib/ipc';
import { Category, MenuItem, Menu } from '../../types/models';
import CategoryList from './components/CategoryList';
import MenuItemList from './components/MenuItemList';
import CategoryModal from './components/CategoryModal';
import MenuItemModal from './components/MenuItemModal';
import RecipeModal from './components/RecipeModal';
import MenuModal from './components/MenuModal';
import CloneMenuModal from './components/CloneMenuModal';
import { Card } from '../../components/atoms/card';
import { useModal } from '../../hooks/useModal';
import { useI18n } from '../../i18n/useI18n';

type MenuData = Category & { items: MenuItem[] };

const MenuPage: React.FC = () => {
  const { t } = useI18n();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  
  const [categories, setCategories] = useState<MenuData[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const { showModal, hideModal } = useModal();

  const fetchMenus = React.useCallback(async (selectId?: number) => {
    try {
      const res = await api.menu.getMenus();
      if (res.success && res.data) {
        setMenus(res.data);
        if (res.data.length > 0) {
          const idToSelect = selectId ?? activeMenuId ?? res.data.find(m => m.is_default)?.id ?? res.data[0].id;
          if (activeMenuId !== idToSelect) {
            setActiveMenuId(idToSelect);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch menus', err);
    }
  }, [activeMenuId]);

  const fetchCategories = React.useCallback(async () => {
    if (!activeMenuId) {return;}
    try {
      const res = await api.menu.getAll(activeMenuId);
      if (res.success && res.data) {
        setCategories(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch menu categories', err);
    }
  }, [activeMenuId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchMenus();
  }, [fetchMenus]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchCategories();
  }, [fetchCategories]);

  const activeCategoryId = selectedCategoryId ?? categories[0]?.id;
  const selectedCategory = categories.find(c => c.id === activeCategoryId);
  const activeMenu = menus.find(m => m.id === activeMenuId);

  return (
    <div className="flex flex-col h-full bg-surface-muted p-6 overflow-hidden">
      <div className="w-full max-w-7xl mx-auto mb-4 flex items-center justify-between gap-4 flex-wrap bg-surface p-4 rounded-card border border-line shadow-card">
        <div className="flex items-center gap-4">
          <h2 className="font-bold text-lg text-body">{t('menu.selectMenu')}</h2>
          <div className="w-64">
            <Select 
              value={activeMenuId ?? ''} 
              onChange={(e) => { setActiveMenuId(Number(e.target.value)); }}
            >
              {menus.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.is_default ? ` ${t('menu.isDefaultSuffix')}` : ''}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            showModal({
              title: t('menu.newMenu'),
              content: <MenuModal menu={null} onSuccess={() => { hideModal(); void fetchMenus(); }} />,
              actions: (
                <>
                  <Button variant="outline" onClick={hideModal}>{t('action.cancel')}</Button>
                  <Button type="submit" form="menu-form" variant="primary">{t('action.create')}</Button>
                </>
              )
            });
          }}>{t('menu.newMenu')}</Button>
          
          {activeMenu && (
            <>
              <Button variant="outline" onClick={() => {
                showModal({
                  title: t('menu.renameMenu'),
                  content: <MenuModal menu={activeMenu} onSuccess={() => { hideModal(); void fetchMenus(); }} />,
                  actions: (
                    <>
                      <Button variant="outline" onClick={hideModal}>{t('action.cancel')}</Button>
                      <Button type="submit" form="menu-form" variant="primary">{t('action.save')}</Button>
                    </>
                  )
                });
              }}>{t('menu.renameMenu')}</Button>

              <Button variant="secondary" onClick={() => {
                showModal({
                  title: t('menu.cloneMenu', { name: activeMenu.name }),
                  content: <CloneMenuModal sourceMenu={activeMenu} onSuccess={(newId) => { hideModal(); void fetchMenus(newId); }} />,
                  actions: (
                    <>
                      <Button variant="outline" onClick={hideModal}>{t('action.cancel')}</Button>
                      <Button type="submit" form="clone-menu-form" variant="primary">{t('menu.clone')}</Button>
                    </>
                  )
                });
              }}>{t('menu.clone')}</Button>
            </>
          )}
        </div>
      </div>

      <div className="flex w-full gap-6 max-w-7xl mx-auto h-[calc(100%-80px)]">
        {/* Left Column: Categories */}
        <Card className="w-1/3">
          <CategoryList 
            categories={categories}
            selectedCategoryId={activeCategoryId}
            onSelect={setSelectedCategoryId}
            onEdit={(cat) => { 
              showModal({
                title: t('menu.editCategory'),
                content: <CategoryModal category={cat} menuId={activeMenuId as number} onSuccess={() => { hideModal(); void fetchCategories(); }} />,
                actions: (
                  <>
                    <Button variant="outline" onClick={hideModal}>{t('action.cancel')}</Button>
                    <Button type="submit" form="category-form" variant="primary">{t('action.save')}</Button>
                  </>
                )
              });
            }}
            onAdd={() => { 
              if (!activeMenuId) {return;}
              showModal({
                title: t('menu.addCategory'),
                content: <CategoryModal category={null} menuId={activeMenuId} onSuccess={() => { hideModal(); void fetchCategories(); }} />,
                actions: (
                  <>
                    <Button variant="outline" onClick={hideModal}>{t('action.cancel')}</Button>
                    <Button type="submit" form="category-form" variant="primary">{t('action.save')}</Button>
                  </>
                )
              });
            }}
            onRefresh={() => { void fetchCategories(); }}
          />
        </Card>

        {/* Right Column: Menu Items */}
        <Card className="w-2/3">
          {selectedCategory ? (
            <MenuItemList 
              category={selectedCategory}
              onEdit={(item) => { 
                showModal({
                  title: t('menu.editDish'),
                  content: <MenuItemModal item={item} categoryId={activeCategoryId} onSuccess={() => { hideModal(); void fetchCategories(); }} />,
                  actions: (
                    <>
                      <Button variant="outline" onClick={hideModal}>{t('action.cancel')}</Button>
                      <Button type="submit" form="menu-item-form" variant="primary">{t('menu.saveDish')}</Button>
                    </>
                  )
                });
              }}
              onRecipeEdit={(item) => { 
                showModal({
                  title: t('menu.recipeFor', { name: item.name }),
                  content: <RecipeModal item={item} onClose={hideModal} />,
                  size: "lg",
                  actions: (
                    <>
                      <Button variant="outline" onClick={hideModal}>{t('action.cancel')}</Button>
                      <Button type="submit" form="recipe-form" variant="primary">{t('menu.saveRecipe')}</Button>
                    </>
                  )
                });
              }}
              onAdd={() => { 
                showModal({
                  title: t('menu.addDish'),
                  content: <MenuItemModal item={null} categoryId={activeCategoryId} onSuccess={() => { hideModal(); void fetchCategories(); }} />,
                  actions: (
                    <>
                      <Button variant="outline" onClick={hideModal}>{t('action.cancel')}</Button>
                      <Button type="submit" form="menu-item-form" variant="primary">{t('menu.saveDish')}</Button>
                    </>
                  )
                });
              }}
              onRefresh={() => { void fetchCategories(); }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-subtle">
              {t('menu.selectCategoryPrompt')}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default MenuPage;
