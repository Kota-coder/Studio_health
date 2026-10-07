
export interface MedicalTestCatalogItem {
  id: string; // Unique ID for the test catalog item
  name: string; // Name of the medical test
  category: string; // Category of the test (e.g., "Blood Work", "Imaging", "Cardiology")
  description?: string; // Optional description of the test
  defaultPrice?: number; // Optional default price for the test
}
