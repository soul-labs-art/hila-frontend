// Archivos ficticios mínimos para las evidencias de ejemplo: no contienen datos de personas reales.
const dataUrl = (type: string, base64: string) => `data:${type};base64,${base64}`
export const samplePng = () => dataUrl('image/png', 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')
export function samplePdf(text: string) {
  const stream = `BT /F1 14 Tf 20 100 Td (${text.replace(/[^\x20-\x7e]/g, '').replace(/[()\\]/g, '')}) Tj ET`
  const pdf = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 360 144]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n`
    + `4 0 obj<</Length ${stream.length}>>stream\n${stream}\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R/Size 6>>\n%%EOF\n`
  return dataUrl('application/pdf', btoa(pdf))
}
