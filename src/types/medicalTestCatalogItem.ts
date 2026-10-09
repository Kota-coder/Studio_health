// One result parameter of a test template, e.g. Hemoglobin, g/dL, normal 12–16.
export interface TestParameter {
  id: string; // key of the value in a result's testData
  label: string;
  type: 'number' | 'text' | 'textarea' | 'choice';
  unit?: string;
  low?: number; // normal range, for numbers
  high?: number;
  options?: string[]; // for choice
  required?: boolean;
}

export interface MedicalTestCatalogItem {
  id: string; // Unique ID for the test catalog item
  name: string; // Name of the medical test
  category: string; // Category of the test (e.g., "Blood Work", "Imaging", "Cardiology")
  description?: string; // Optional description of the test
  defaultPrice?: number; // Optional default price for the test
  fields?: TestParameter[]; // the result template; empty uses the built-in one for known tests
}
