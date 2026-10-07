
export interface TreatmentTemplateFieldOption {
  label: string;
  value: string;
}

export interface TreatmentTemplateField {
  fieldId: string;
  label: string;
  fieldType: 'text' | 'number' | 'textarea' | 'select';
  options?: TreatmentTemplateFieldOption[];
  placeholder?: string;
  required?: boolean;
}

export interface TreatmentTemplate {
  id: string;
  name: string;
  description?: string;
  careNoteFields: TreatmentTemplateField[];
}

export const TREATMENT_TEMPLATES: TreatmentTemplate[] = [
  {
    id: 'none', // Special ID for general notes
    name: 'General Note (No Template)',
    careNoteFields: [],
  },
  {
    id: 'post_op_knee_checkup',
    name: 'Post-Op Knee Checkup',
    description: 'Standard follow-up for post-operative knee patients.',
    careNoteFields: [
      { fieldId: 'pain_level', label: 'Pain Level (1-10)', fieldType: 'number', placeholder: 'e.g., 3', required: true },
      {
        fieldId: 'swelling_status',
        label: 'Swelling Status',
        fieldType: 'select',
        options: [
          // {label: 'Select Status', value: ''}, // Removed this problematic option
          {label: 'None', value: 'none'},
          {label: 'Mild', value: 'mild'},
          {label: 'Moderate', value: 'moderate'},
          {label: 'Severe', value: 'severe'}
        ],
        placeholder: 'Select Swelling Status', // Added placeholder guidance
        required: true
      },
      { fieldId: 'range_of_motion', label: 'Range of Motion (degrees)', fieldType: 'text', placeholder: 'e.g., 0-90 Flexion' },
      { fieldId: 'wound_check', label: 'Wound Check Notes', fieldType: 'textarea', placeholder: 'Observations about the wound condition, signs of infection, etc.' },
      { fieldId: 'medication_compliance', label: 'Medication Compliance', fieldType: 'textarea', placeholder: 'e.g., Taking all prescribed medications as directed.'},
    ],
  },
  {
    id: 'diabetes_follow_up',
    name: 'Diabetes Follow-Up',
    description: 'Routine follow-up for patients with diabetes.',
    careNoteFields: [
      { fieldId: 'fasting_bs', label: 'Fasting Blood Sugar (mg/dL)', fieldType: 'number', placeholder: 'e.g., 110' },
      { fieldId: 'hba1c', label: 'HbA1c (%)', fieldType: 'number', placeholder: 'e.g., 7.0' },
      {
        fieldId: 'medication_adherence',
        label: 'Medication Adherence',
        fieldType: 'select',
        options: [
          // {label: 'Select Adherence', value: ''}, // Removed this problematic option
          {label: 'Good', value: 'good'},
          {label: 'Fair', value: 'fair'},
          {label: 'Poor', value: 'poor'}
        ],
        placeholder: 'Select Medication Adherence' // Added placeholder guidance
      },
      { fieldId: 'foot_exam_notes', label: 'Foot Exam Notes', fieldType: 'textarea', placeholder: 'Findings from foot examination.'},
      { fieldId: 'diet_lifestyle_counseling', label: 'Diet/Lifestyle Counseling', fieldType: 'textarea', placeholder: 'Topics discussed and patient response.' },
    ],
  },
  {
    id: 'hypertension_check',
    name: 'Hypertension Check-up',
    description: 'Routine check-up for managing hypertension.',
    careNoteFields: [
        { fieldId: 'bp_systolic', label: 'Systolic BP (mmHg)', fieldType: 'number', placeholder: 'e.g., 130', required: true },
        { fieldId: 'bp_diastolic', label: 'Diastolic BP (mmHg)', fieldType: 'number', placeholder: 'e.g., 80', required: true },
        { fieldId: 'heart_rate_bpm', label: 'Heart Rate (bpm)', fieldType: 'number', placeholder: 'e.g., 70'},
        { fieldId: 'lifestyle_modifications', label: 'Lifestyle Modifications Discussed', fieldType: 'textarea', placeholder: 'e.g., DASH diet, exercise plan.'},
        { fieldId: 'medication_review', label: 'Medication Review Notes', fieldType: 'textarea', placeholder: 'Current medications, adjustments, side effects.'},
    ]
  }
];
