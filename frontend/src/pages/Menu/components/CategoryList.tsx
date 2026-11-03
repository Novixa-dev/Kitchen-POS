import { Button } from '../../../components/atoms';
import React from 'react';
import { Category, MenuItem } from '../../../types/models';
import { api } from '../../../lib/ipc';
import { useModal } from '../../../hooks/useModal';
import { useToast } from '../../../hooks/useToast';
import { useI18n } from '../../../i18n/useI18n';
import { SvgIcon } from '../../../components/atoms/svg-sprite-loader';

type MenuData = Category & { items: MenuItem[] };

interface Props {
  categories: MenuData[];
  selectedCategoryId: number | null;
  onSelect: (id: number) => void;
  onEdit: (cat: Category) => void;
  onAdd: () => void;
  onRefresh: () => void;
}

const CategoryList: React.FC<Props> = ({
  categories,
  selectedCategoryId,
  onSelect,
  onEdit,
  onAdd,
  onRefresh,
}) => {
  const { showModal, hideModal } = useModal();
  const { showToast } = useToast();
  const { t, tPlural } = useI18n();

  const handleDelete = (category: MenuData) => {
    showModal({
      title: t('menu.deleteCategory'),
      size: 'sm',
      content: (
        <p className="text-muted">
          {t('menu.deleteCategoryConfirm', { name: category.name })}
          {' '}
          {t('menu.deleteCategoryWarning')}
        </p>
      ),
      actions: (
        <>
          <Button variant="outline" onClick={hideModal}>{t('action.cancel')}</Button>
          <Button
            variant="danger"
            onClick={() => {
              hideModal();
              api.menu.deleteCategory({ id: category.id })
                .then(res => {
                  if (res.success) {
                    showToast({ message: t('toast.deleted'), variant: 'success' });
                    onRefresh();
                  } else {
                    showToast({ message: res.error ?? t('toast.failed'), variant: 'error' });
                  }
                })
                .catch(() => {
                  showToast({ message: t('toast.unexpectedError'), variant: 'error' });
                });
            }}
          >
            {t('action.delete')}
          </Button>
        </>
      ),
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-line flex justify-between items-center gap-2 bg-surface-muted">
        <h2 className="font-bold text-lg text-body">{t('menu.categories')}</h2>
        <Button variant="primary" size="sm" icon="plus" onClick={onAdd}>
          {t('action.add')}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {categories.map(cat => (
          // Selecting a category is keyboard-reachable; the row actions sit
          // outside the button so they are not nested interactive elements.
          <div
            key={cat.id}
            className={`rounded-control flex justify-between items-center gap-1 transition-colors border ${
              selectedCategoryId === cat.id
                ? 'bg-brand-subtle border-brand/40'
                : 'border-transparent hover:bg-surface-sunken'
            }`}
          >
            <button
              type="button"
              onClick={() => { onSelect(cat.id); }}
              className="flex-1 min-w-0 p-3 text-start"
              aria-current={selectedCategoryId === cat.id}
            >
              <div className={`font-medium truncate ${selectedCategoryId === cat.id ? 'text-brand' : 'text-body'}`}>
                {cat.name}
              </div>
              <div className="text-xs text-subtle">{tPlural('menu.itemCount', cat.items.length)}</div>
            </button>

            <div className="flex gap-1 pe-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-subtle hover:text-brand"
                onClick={() => { onEdit(cat); }}
                aria-label={t('menu.editCategory')}
              >
                <SvgIcon name="edit" width="14" height="14" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-subtle hover:text-danger"
                onClick={() => { handleDelete(cat); }}
                aria-label={t('menu.deleteCategory')}
              >
                <SvgIcon name="trash" width="14" height="14" />
              </Button>
            </div>
          </div>
        ))}

        {categories.length === 0 && (
          <div className="p-8 text-center text-subtle text-sm">
            {t('menu.noCategoriesHint')}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryList;
