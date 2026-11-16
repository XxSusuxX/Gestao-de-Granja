import type { ProductInputCategory } from './productInputCategory';

export interface ProductInput {
  /** @minLength 1 */
  name: string;
  category: ProductInputCategory;
  /** @minLength 1 */
  unit: string;
  /** @minimum 0 */
  quantity: number;
  /** @nullable */
  minimumQuantity?: number | null;
  /** @nullable */
  unitCost?: number | null;
  /** @nullable */
  imageData?: string | null;
  /** @nullable */
  imageSignature?: string | null;
}
