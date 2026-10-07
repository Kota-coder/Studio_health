export interface TestFormField {
  id: string; // e.g., 'hemoglobin', 'leadPlacement'
  label: string; // e.g., 'Hemoglobin (g/dL)', 'Lead Placement'
  type: 'text' | 'number' | 'textarea';
  placeholder?: string;
  required?: boolean;
}

export interface TestTypeDef {
  id: string; // e.g., 'blood_panel', 'ecg'
  name: string; // e.g., 'Blood Panel', 'ECG'
  fields: TestFormField[];
}

export const TEST_DEFINITIONS: TestTypeDef[] = [
  {
    id: 'blood_panel',
    name: 'Blood Panel',
    fields: [
      { id: 'hemoglobin', label: 'Hemoglobin (g/dL)', type: 'number', placeholder: 'e.g., 14.5', required: true },
      { id: 'wbc_count', label: 'WBC Count (x10^9/L)', type: 'number', placeholder: 'e.g., 7.2' },
      { id: 'platelets', label: 'Platelets (x10^9/L)', type: 'number', placeholder: 'e.g., 250' },
      { id: 'rbc_count', label: 'RBC Count (x10^12/L)', type: 'number', placeholder: 'e.g., 4.5' },
    ],
  },
  {
    id: 'ecg',
    name: 'ECG',
    fields: [
      { id: 'rhythm', label: 'Rhythm', type: 'text', placeholder: 'e.g., Sinus Rhythm', required: true },
      { id: 'rate_bpm', label: 'Heart Rate (bpm)', type: 'number', placeholder: 'e.g., 75' },
      { id: 'pr_interval_ms', label: 'PR Interval (ms)', type: 'number', placeholder: 'e.g., 160' },
      { id: 'qrs_duration_ms', label: 'QRS Duration (ms)', type: 'number', placeholder: 'e.g., 90' },
      { id: 'qt_qtc_interval_ms', label: 'QT/QTc Interval (ms)', type: 'text', placeholder: 'e.g., 400/420' },
      { id: 'axis_degrees', label: 'Axis (degrees)', type: 'text', placeholder: 'e.g., +60' },
      { id: 'interpretation_notes', label: 'Interpretation Notes', type: 'textarea', placeholder: 'Detailed interpretation...' },
    ],
  },
  {
    id: 'xray',
    name: 'X-Ray',
    fields: [
      { id: 'body_part_imaged', label: 'Body Part Imaged', type: 'text', placeholder: 'e.g., Chest AP/Lateral', required: true },
      { id: 'findings_summary', label: 'Findings Summary', type: 'textarea', placeholder: 'Describe findings...' },
      { id: 'impression', label: 'Impression', type: 'textarea', placeholder: 'Clinical impression...' },
    ],
  },
  {
    id: 'generic_test',
    name: 'Generic / Other Test',
    fields: [
      { id: 'test_description', label: 'Test Description/Name', type: 'text', placeholder: 'Specify test name', required: true },
      { id: 'result_value', label: 'Result / Value', type: 'text', placeholder: 'Enter result details' },
    ]
  }
];