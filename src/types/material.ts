
export interface Material {
  id: string;
  name: string;
  category?: string;
  unitOfMeasure: string; // e.g., "pack", "box", "each", "roll"
  listPrice?: number; // Cost per unitOfMeasure
  associatedTreatmentTemplateName?: string; // Optional: Name of the TreatmentTemplate this material is often used with
  notes?: string;
}
