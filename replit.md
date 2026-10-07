# Medical Management System - Replit Project

## Overview
A comprehensive Next.js-based medical management system for patient registration, care notes, medical tests, billing, and staff management. The application uses local storage for data persistence and includes AI-powered patient detail extraction from ID cards.

## Recent Changes

### October 28, 2025 - Added Accounts Role
- Added new "Accounts" staff role for financial operations
- Accounts role has access to:
  - Billing pages (view and manage bills)
  - Payments pages (view and manage payments)
  - Financial dashboard (view financial metrics and charts)
  - Patient records (view patient information for billing purposes)
- Updated access control on billing, payments, and financial dashboard pages
- Added sample Accounts staff member (Amit Verma) to seed data
- Documentation updated to reflect all 5 staff roles and their permissions

### October 28, 2025 - Comprehensive Seed Data System
- Created complete seed data system to populate the application with sample data
- **Admin Setup Page**: New `/admin` page for easy data initialization and management
  - One-click seed data loading with visual confirmation
  - Data summary dashboard showing counts for all entities
  - Clear all data functionality with confirmation
  - Quick navigation to all major application sections
- **Seed Data Structure** (in `src/lib/seedData/`):
  - `attachments.ts` - Sample base64 images for all attachment types
  - `staff.ts` - 6 staff members (2 doctors, 2 nurses, 2 reception)
  - `medications.ts` - 8 medications with dosage information
  - `referringDoctors.ts` - 5 referring doctors with contact details
  - `patients.ts` - 3 complete patient records with:
    - Multiple ID card images and patient photos
    - Care notes with attachments
    - Medical test results (ECG, Blood Panel) with attachments
    - Complete audit logs
    - Medication records with dosage information
  - `bills.ts` - 4 sample bills with multiple attachments
  - `index.ts` - Utility functions for data initialization and management
- **Type Definitions**: Added missing `idCardImages` and `patientPhotos` fields to Patient type

### October 28, 2025 - Multiple Image Upload Support
- Enhanced all attachment fields to support multiple image uploads across the entire application
- Updated TypeScript type definitions to include `attachments?: string[]` field for:
  - `Patient` type: `idCardImages`, `patientPhotos`, `initialObservationAttachments`
  - `CareNote` type: `attachments`
  - `TestEntry` type: `attachments`
  - `Bill` type: `attachments`
- Updated files:
  - `src/app/page.tsx` - Multiple ID card images and patient photos upload
  - `src/app/patients/[patientId]/page.tsx` - Multiple attachments for care notes and medical tests
  - `src/app/billing/form/BillingForm.tsx` - Multiple bill attachments support
  - `src/app/patients/[patientId]/admission/page.tsx` - Multiple initial observation attachments
  - All type definitions updated to support attachment arrays
- UI Pattern: Hidden file input with `multiple` attribute, grid display of images, individual X delete buttons for each attachment
- Backward compatibility: Maintained `attachmentDataUrl` fields for legacy support (first image in array)
- File validation: 2MB limit per file maintained across all upload locations
- Added "Add More (count)" button text and "Clear All" functionality

### October 28, 2025 - Complete Removal of Camera Functionality
- Removed all camera/scan functionality throughout the application
- Replaced camera features with file upload functionality only
- Configuration runs on port 5000 with host binding to 0.0.0.0 for Replit environment

## Project Architecture

### Technology Stack
- **Framework**: Next.js 15.2.3 with Turbopack
- **UI Components**: Radix UI with Tailwind CSS
- **AI Integration**: Google Genkit for patient detail extraction
- **Authentication**: Firebase Authentication
- **State Management**: React hooks and local storage
- **Date Handling**: date-fns
- **Form Management**: react-hook-form with Zod validation

### Key Features
1. **Patient Management**
   - Patient registration with ID card upload
   - AI-powered detail extraction from government IDs
   - Patient photo upload
   - Patient admission and discharge workflow
   - Staff assignment to patients

2. **Care Notes & Medical Records**
   - Template-based and free-form care notes
   - Medication tracking with dosage information
   - Image attachments via file upload for documentation
   - Treatment templates for common procedures

3. **Medical Tests**
   - Test catalog management
   - Dynamic test field definitions
   - Test result recording with file upload attachments
   - Staff assignment for tests

4. **Billing System**
   - Pharmacy and treatment billing
   - Multiple payment methods (Cash, UPI, Card, Insurance, etc.)
   - Bill attachments via file upload
   - Audit log for all bill changes

5. **Staff & Security**
   - Role-based access control with 5 roles:
     - **Admin**: Full access to all features
     - **Doctor**: Access to patient care, staff management, and financial dashboard
     - **Nurse**: Access to patient care, materials, and vendors
     - **Receptionist**: Limited access for patient registration
     - **Accounts**: Access to billing, payments, financial dashboard, and patient records
   - Staff management portal
   - Audit logging for all patient changes

### File Upload Implementation
All attachment features use file upload functionality:
- Simple file input with upload button UI pattern
- 2MB file size limit for attachments
- Image preview after upload
- Clear/change file options available

### Server Configuration
- Development server runs on port 5000
- Binds to 0.0.0.0 for Replit environment compatibility
- Hot module replacement enabled via Turbopack

## User Preferences
- File upload only for all attachments (no camera/scan functionality)
- Clean, professional UI with accessibility considerations
- Responsive design for both mobile and desktop use
- Simple, consistent upload pattern across all features
