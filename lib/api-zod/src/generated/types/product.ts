import type { ProductCategory } from './productCategory';

export interface Product {
  id: number;
  name: string;
  category: ProductCategory;
  unit: string;
  quantity: number;
  /** @nullable */
  minimumQuantity: number | null;
  /** @nullable */
  unitCost: number | null;
  /** @nullable */
  imageData?: string | null;
  /** @nullable */
  imageSignature?: string | null;
  createdAt: Date;
}
