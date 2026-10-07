import type { Medication } from '@/types/medication';

export const SEED_MEDICATIONS: Medication[] = [
  {
    id: "1",
    name: "Aspirin",
    treatment: "Cardiac Care",
    listPrice: 5.50,
    quantityInPackage: 100,
    unitOfMeasure: "tablets",
    additionalNotes: "Blood thinner, reduces risk of heart attack and stroke"
  },
  {
    id: "2",
    name: "Atorvastatin",
    treatment: "Cholesterol Management",
    listPrice: 12.00,
    quantityInPackage: 30,
    unitOfMeasure: "tablets",
    additionalNotes: "Lowers cholesterol levels"
  },
  {
    id: "3",
    name: "Metoprolol",
    treatment: "Cardiac Care",
    listPrice: 8.75,
    quantityInPackage: 60,
    unitOfMeasure: "tablets",
    additionalNotes: "Controls heart rate and blood pressure"
  },
  {
    id: "4",
    name: "Lisinopril",
    treatment: "Blood Pressure Management",
    listPrice: 10.00,
    quantityInPackage: 30,
    unitOfMeasure: "tablets",
    additionalNotes: "Treats high blood pressure and heart failure"
  },
  {
    id: "5",
    name: "Warfarin",
    treatment: "Blood Thinner",
    listPrice: 15.50,
    quantityInPackage: 50,
    unitOfMeasure: "tablets",
    additionalNotes: "Prevents blood clots"
  },
  {
    id: "6",
    name: "Furosemide",
    treatment: "Fluid Management",
    listPrice: 6.25,
    quantityInPackage: 40,
    unitOfMeasure: "tablets",
    additionalNotes: "Reduces fluid retention"
  },
  {
    id: "7",
    name: "Clopidogrel",
    treatment: "Cardiac Care",
    listPrice: 18.00,
    quantityInPackage: 30,
    unitOfMeasure: "tablets",
    additionalNotes: "Prevents platelets from clumping together"
  },
  {
    id: "8",
    name: "Digoxin",
    treatment: "Cardiac Care",
    listPrice: 11.50,
    quantityInPackage: 60,
    unitOfMeasure: "tablets",
    additionalNotes: "Strengthens heart contractions"
  }
];
