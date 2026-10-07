import type { Bill } from '@/types/billing';
import { getRandomAttachments } from './attachments';

export const SEED_BILLS: Bill[] = [
  {
    id: "BILL-001",
    patientId: 1,
    patientName: "Rajesh Kumar",
    billDate: "21/10/2025",
    billType: "Treatment",
    items: [
      {
        id: "item_1",
        description: "Cardiac Consultation",
        quantity: 1,
        unitPrice: 1500,
        originalUnitPrice: 1500,
        total: 1500
      },
      {
        id: "item_2",
        description: "ECG Test",
        quantity: 1,
        unitPrice: 800,
        originalUnitPrice: 800,
        total: 800
      },
      {
        id: "item_3",
        description: "Blood Panel Test",
        quantity: 1,
        unitPrice: 1200,
        originalUnitPrice: 1200,
        total: 1200
      }
    ],
    totalAmount: 3500,
    paymentMethod: "UPI",
    paymentStatus: "Paid",
    paymentDate: "21/10/2025",
    notes: "Initial consultation and diagnostic tests",
    createdAt: "2025-10-21T15:00:00.000Z",
    auditLog: [
      {
        id: "audit_bill_1_1",
        timestamp: "2025-10-21T15:00:00.000Z",
        staffId: 6,
        staffName: "Priya Sharma",
        actionType: "Bill Created",
        changeDetails: "Treatment bill created for patient Rajesh Kumar"
      }
    ],
    attachmentDataUrl: getRandomAttachments('invoice', 1)[0],
    attachments: getRandomAttachments('invoice', 2)
  },
  {
    id: "BILL-002",
    patientId: 1,
    patientName: "Rajesh Kumar",
    billDate: "25/10/2025",
    billType: "Pharmacy",
    items: [
      {
        id: "item_4",
        description: "Metoprolol 50mg (30 tablets)",
        quantity: 1,
        unitPrice: 180,
        originalUnitPrice: 200,
        total: 180
      },
      {
        id: "item_5",
        description: "Lisinopril 10mg (30 tablets)",
        quantity: 1,
        unitPrice: 140,
        originalUnitPrice: 150,
        total: 140
      }
    ],
    totalAmount: 320,
    paymentMethod: "Cash",
    paymentStatus: "Paid",
    paymentDate: "25/10/2025",
    notes: "Monthly medication refill",
    createdAt: "2025-10-25T16:00:00.000Z",
    auditLog: [
      {
        id: "audit_bill_2_1",
        timestamp: "2025-10-25T16:00:00.000Z",
        staffId: 6,
        staffName: "Priya Sharma",
        actionType: "Bill Created",
        changeDetails: "Pharmacy bill created for patient Rajesh Kumar"
      }
    ],
    attachmentDataUrl: getRandomAttachments('invoice', 1)[0],
    attachments: getRandomAttachments('invoice', 3)
  },
  {
    id: "BILL-003",
    patientId: 2,
    patientName: "Sunita Reddy",
    billDate: "22/10/2025",
    billType: "Treatment",
    items: [
      {
        id: "item_6",
        description: "Emergency Cardiac Assessment",
        quantity: 1,
        unitPrice: 3000,
        originalUnitPrice: 3000,
        total: 3000
      },
      {
        id: "item_7",
        description: "ECG Test (Emergency)",
        quantity: 1,
        unitPrice: 1200,
        originalUnitPrice: 1200,
        total: 1200
      },
      {
        id: "item_8",
        description: "Cardiac Monitoring (24 hours)",
        quantity: 1,
        unitPrice: 5000,
        originalUnitPrice: 5000,
        total: 5000
      }
    ],
    totalAmount: 9200,
    paymentMethod: "Insurance",
    paymentStatus: "Partially Paid",
    notes: "Emergency admission - Insurance claim submitted",
    createdAt: "2025-10-22T18:00:00.000Z",
    auditLog: [
      {
        id: "audit_bill_3_1",
        timestamp: "2025-10-22T18:00:00.000Z",
        staffId: 6,
        staffName: "Priya Sharma",
        actionType: "Bill Created",
        changeDetails: "Emergency treatment bill created for patient Sunita Reddy"
      }
    ],
    attachmentDataUrl: getRandomAttachments('invoice', 1)[0],
    attachments: getRandomAttachments('invoice', 2)
  },
  {
    id: "BILL-004",
    patientId: 3,
    patientName: "Mohammed Ali",
    billDate: "15/10/2025",
    billType: "Pharmacy",
    items: [
      {
        id: "item_9",
        description: "Metoprolol 25mg (60 tablets)",
        quantity: 1,
        unitPrice: 160,
        originalUnitPrice: 175,
        total: 160
      },
      {
        id: "item_10",
        description: "Furosemide 40mg (30 tablets)",
        quantity: 1,
        unitPrice: 90,
        originalUnitPrice: 100,
        total: 90
      },
      {
        id: "item_11",
        description: "Digoxin 0.25mg (30 tablets)",
        quantity: 1,
        unitPrice: 130,
        originalUnitPrice: 145,
        total: 130
      }
    ],
    totalAmount: 380,
    paymentMethod: "Arogyasree",
    paymentStatus: "Paid",
    paymentDate: "15/10/2025",
    notes: "Chronic medication supply via Arogyasree scheme",
    createdAt: "2025-10-15T14:00:00.000Z",
    auditLog: [
      {
        id: "audit_bill_4_1",
        timestamp: "2025-10-15T14:00:00.000Z",
        staffId: 6,
        staffName: "Priya Sharma",
        actionType: "Bill Created",
        changeDetails: "Pharmacy bill created for patient Mohammed Ali"
      }
    ],
    attachmentDataUrl: getRandomAttachments('invoice', 1)[0],
    attachments: getRandomAttachments('invoice', 1)
  }
];
