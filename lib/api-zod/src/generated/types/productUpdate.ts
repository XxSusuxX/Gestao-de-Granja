import type { ProductUpdateCategory } from './productUpdateCategory';

export interface ProductUpdate {
  /** @minLength 1 */
  name?: string;
  category?: ProductUpdateCategory;
  /** @minLength 1 */
  unit?: string;
  /** @nullable */
  minimumQuantity?: number | null;
  /** @nullable */
  unitCost?: number | null;
  /** @nullable */
  imageData?: string | null;
  /** @nullable */
  imageSignature?: string | null;
}
