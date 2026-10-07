
export interface Medication {
  id: string;
  name: string;
  treatment: string; // Name of the selected TreatmentTemplate
  listPrice: number; // Price for the 'quantityInPackage' of 'unitOfMeasure'
  quantityInPackage?: number; // e.g., 10, 100.5. This is the "number of units" that can be decimal.
  unitOfMeasure: string; // e.g., "tablet", "ml", "bottle", "strip". This is the old 'units' field, renamed.
  additionalNotes?: string;
}
