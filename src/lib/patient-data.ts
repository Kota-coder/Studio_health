// Client calls for patient data requests (see src/config/features.ts).

export async function downloadPatientData(patientId: number): Promise<void> {
  const response = await fetch(`/api/patients/${patientId}/data`);
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error((result as { error?: string }).error ?? 'Could not export patient data.');
  }
  const filename = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')?.[1]
    ?? `patient-${patientId}-data.json`;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function erasePatientData(patientId: number): Promise<void> {
  const response = await fetch(`/api/patients/${patientId}/data`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmPatientId: patientId }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error((result as { error?: string }).error ?? 'Could not erase patient data.');
  }
}
