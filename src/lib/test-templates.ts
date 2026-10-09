// Test templates: the result parameters a test asks for. Each test in the catalog can have
// its own (Setup → Medical Tests); tests without one use the built-in template for known
// tests (src/config/testTypes.ts), matched by name.
import { TEST_DEFINITIONS } from '@/config/testTypes';
import type { MedicalTestCatalogItem, TestParameter } from '@/types/medicalTestCatalogItem';
import type { TestEntry } from '@/types/patient';

export function builtinParameters(testName?: string): TestParameter[] {
  const name = testName?.trim().toLowerCase();
  const definition = name ? TEST_DEFINITIONS.find(def => def.name.toLowerCase() === name) : undefined;
  return (definition?.fields ?? []).map(f => {
    // "Hemoglobin (g/dL)" → label "Hemoglobin", unit "g/dL"
    const withUnit = f.type === 'number' ? /^(.*\S)\s*\(([^()]+)\)$/.exec(f.label) : null;
    return {
      id: f.id, label: withUnit ? withUnit[1] : f.label, type: f.type,
      ...(withUnit ? { unit: withUnit[2] } : {}), ...(f.required ? { required: true } : {}),
    };
  });
}

export function parametersFor(item: Pick<MedicalTestCatalogItem, 'name' | 'fields'> | undefined, fallbackName?: string): TestParameter[] {
  return item?.fields?.length ? item.fields : builtinParameters(item?.name ?? fallbackName);
}

// The parameters a recorded result was entered with.
export const resultParameters = (test: Pick<TestEntry, 'resultFields' | 'testTypeName'>) =>
  test.resultFields?.length ? test.resultFields : builtinParameters(test.testTypeName);

// "12–16 g/dL", "< 200 mg/dL", or "" when there is no range.
export function normalRange(p: TestParameter): string {
  const unit = p.unit ? ` ${p.unit}` : '';
  if (p.low != null && p.high != null) return `${p.low}–${p.high}${unit}`;
  if (p.high != null) return `< ${p.high}${unit}`;
  if (p.low != null) return `> ${p.low}${unit}`;
  return '';
}

// 'High' or 'Low' when a number is outside the normal range.
export function rangeFlag(p: TestParameter, value: unknown): 'High' | 'Low' | null {
  if (p.type !== 'number' || value === '' || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (p.high != null && n > p.high) return 'High';
  if (p.low != null && n < p.low) return 'Low';
  return null;
}

// A key for a new parameter from its label, unique among the others.
export function parameterId(label: string, taken: string[]): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'value';
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}_${n}`;
  return id;
}
