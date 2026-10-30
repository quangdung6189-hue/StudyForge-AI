// Next.js runs this module synchronously before React hydration.
// Browser extensions can add these attributes to the server-rendered DOM,
// including Next.js metadata elements that our components do not control.
// Remove only the known injected markers; preserve application attributes
// and let React continue reporting other hydration mismatches.
const processedMarker = /^__processed_[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}__$/i;

function cleanElement(element: Element) {
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
for (const element of document.querySelectorAll('*')) cleanElement(element);

// Client navigation inserts fresh RSC content after the initial document hydration.
// Clean only known extension markers there too; never suppress React diagnostics.
const globalCleanup = window as Window & { __studyforgeExtensionCleaner?: () => void };
globalCleanup.__studyforgeExtensionCleaner?.();
const observer = new MutationObserver(records => {
  for (const record of records) {
    if (record.type === 'attributes') {
      const name = record.attributeName ?? '';
      if ((name === 'bis_skin_checked' || name === 'bis_register' || processedMarker.test(name)) && record.target instanceof Element && record.target.hasAttribute(name)) record.target.removeAttribute(name);
    } else for (const node of record.addedNodes) {
      if (!(node instanceof Element)) continue;
      cleanElement(node); for (const child of node.querySelectorAll('*')) cleanElement(child);
    }
  }
});
observer.observe(document.documentElement, { childList: true, attributes: true, subtree: true });
globalCleanup.__studyforgeExtensionCleaner = () => observer.disconnect();
