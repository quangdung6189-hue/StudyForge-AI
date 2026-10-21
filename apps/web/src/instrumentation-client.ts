// Next.js runs this module synchronously before React hydration.
// Browser extensions can add these attributes to the server-rendered DOM,
// including Next.js metadata elements that our components do not control.
// Remove only the known injected markers; preserve application attributes
// and let React continue reporting other hydration mismatches.
const processedMarker = /^__processed_[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}__$/i;

for (const element of document.querySelectorAll('*')) {
  for (const attribute of element.getAttributeNames()) {
    if (
      attribute === 'bis_skin_checked' ||
      attribute === 'bis_register' ||
      processedMarker.test(attribute)
    ) {
      element.removeAttribute(attribute);
    }
  }
}
