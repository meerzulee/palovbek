import catalog from '../shared/recipes.json' with { type: 'json' };
import { INGREDIENTS } from './simulation';
import type { IngredientId } from './simulation';

export const RECIPES = catalog.recipes;
export const EXTRA_INGREDIENTS = catalog.ingredients as typeof INGREDIENTS;
export const ALL_INGREDIENTS = [...INGREDIENTS, ...EXTRA_INGREDIENTS];
export const ingredientName = (id: string) => ALL_INGREDIENTS.find(item => item.id === id)?.name ?? id;
export const ingredientsFor = (ids?: IngredientId[]) => ids ? ids.map(id => ALL_INGREDIENTS.find(item => item.id === id)!).filter(Boolean) : INGREDIENTS;
