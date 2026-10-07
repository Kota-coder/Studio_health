// Sample base64 encoded images for attachments
// These are small colored rectangles to represent different document types

export const SAMPLE_ATTACHMENTS = {
  // ID Card images (blue-tinted)
  idCard1: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FAP0iBAcIN99PAAAAAElFTkSuQmCC",
  idCard2: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNkYPhfz0AEYBxVSF+FAABzAgT/e+2hAAAAAElFTkSuQmCC",
  
  // Patient photos (skin-tone colored)
  patientPhoto1: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR42mP8z8Dwn4EIwDiqkL4KAQD5/QP/WWj3+gAAAABJRU5ErkJggg==",
  patientPhoto2: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR42mP8//8/QwMREYBxVCF9FQIA8ZUDP+e7qMsAAAAASUVORK5CYII=",
  
  // Medical documents (white/gray)
  medicalDoc1: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8//8/AwMDQz0DEYBxVCEAKfkE/9uxkpQAAAAASUVORK5CYII=",
  medicalDoc2: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+P+/noEIwDiqkL4KAej+A/961tTRAAAAAElFTkSuQmCC",
  medicalDoc3: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR42mP8/5+hgYGIwDiqkL4KAQDq/wQHiPbxEgAAAABJRU5ErkJggg==",
  
  // Lab results (green-tinted)
  labResult1: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR42mNk+M/QwEBEYBxVSF+FAACy/gP/OKznGAAAAABJRU5ErkJggg==",
  labResult2: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR42mNkYPjfwEBEYBxVSF+FAACo/gP/c0kCnQAAAABJRU5ErkJggg==",
  labResult3: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR42mNk+P+fgYjAOKqQvgoBAKX+A/+wcIl8AAAAAElFTkSuQmCC",
  
  // Bills/Invoices (yellow-tinted)
  invoice1: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR42mP8/5+hnoGYwDiqkL4KAQDc/wP/uT9IfgAAAABJRU5ErkJggg==",
  invoice2: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR42mP8z8BQz0BkYBxVSF+FAAC8/gP/SMVyvQAAAABJRU5ErkJggg==",
  invoice3: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR42mNk+M9Qz0BsYBxVSF+FAACk/gP/YXkxVQAAAABJRU5ErkJggg==",
};

export function getRandomAttachments(type: 'idCard' | 'patientPhoto' | 'medical' | 'lab' | 'invoice', count: number = 2): string[] {
  const attachmentMap = {
    idCard: [SAMPLE_ATTACHMENTS.idCard1, SAMPLE_ATTACHMENTS.idCard2],
    patientPhoto: [SAMPLE_ATTACHMENTS.patientPhoto1, SAMPLE_ATTACHMENTS.patientPhoto2],
    medical: [SAMPLE_ATTACHMENTS.medicalDoc1, SAMPLE_ATTACHMENTS.medicalDoc2, SAMPLE_ATTACHMENTS.medicalDoc3],
    lab: [SAMPLE_ATTACHMENTS.labResult1, SAMPLE_ATTACHMENTS.labResult2, SAMPLE_ATTACHMENTS.labResult3],
    invoice: [SAMPLE_ATTACHMENTS.invoice1, SAMPLE_ATTACHMENTS.invoice2, SAMPLE_ATTACHMENTS.invoice3],
  };
  
  const pool = attachmentMap[type];
  return pool.slice(0, Math.min(count, pool.length));
}
