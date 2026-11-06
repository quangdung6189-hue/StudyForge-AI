import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { ommlToLatex } from '@/lib/omml-to-latex';

/**
 * Preprocess DOCX to convert Word Equations (OMML), MathType equations, and mc:AlternateContent
 * into native Word text runs (<w:r><w:t>$LaTeX$</w:t></w:r>) before Mammoth runs.
 * This ensures:
 * 1. Equations are preserved as clean LaTeX ($...$) instead of being ignored.
 * 2. Fallback equation images (e.g. preview WMF/PNG) are removed so Mammoth does NOT
 *    turn them into fake diagrams like "[Hình 6]".
 * 3. Real diagrams and figures remain intact.
 */
export async function preprocessDocxMathAndImages(buffer: Buffer): Promise<{
  buffer: Buffer;
  convertedEquationCount: number;
}> {
  const zip = await JSZip.loadAsync(buffer);
  const docFile = zip.file('word/document.xml');
  if (!docFile) return { buffer, convertedEquationCount: 0 };

  const xmlText = await docFile.async('string');
  const parser = new DOMParser({
    errorHandler: { warning() {}, error() {}, fatalError() {} }
  });
  const doc = parser.parseFromString(xmlText, 'application/xml');
  let convertedEquationCount = 0;

  // 1. Unwrap mc:AlternateContent
  // Word wraps new equations in mc:AlternateContent:
  // mc:Choice has <m:oMath>, mc:Fallback has fallback picture <v:shape><v:imagedata>
  const alternateContents = Array.from(doc.getElementsByTagName('mc:AlternateContent'));
  for (const ac of alternateContents) {
    const parent = ac.parentNode;
    if (!parent) continue;

    // Find mc:Choice
    const choices = Array.from(ac.getElementsByTagName('mc:Choice'));
    const choice = choices[0];
    if (choice) {
      // Move all children of choice to parent before ac
      while (choice.firstChild) {
        parent.insertBefore(choice.firstChild, ac);
      }
    }
    // Remove the entire mc:AlternateContent (including mc:Fallback)
    parent.removeChild(ac);
  }

  // 2. Remove equation fallback shapes inside w:object (MathType OLE)
  // so Mammoth does not emit an <img> for MathType equations
  const objects = Array.from(doc.getElementsByTagName('w:object'));
  for (const obj of objects) {
    const isEquation = Array.from(obj.getElementsByTagName('o:OLEObject')).some(ole => {
      const progId = ole.getAttribute('ProgID') || '';
      return /Equation/i.test(progId);
    });

    if (isEquation) {
      // Find any v:shape / v:imagedata / w:drawing inside this equation object and remove it
      const shapes = Array.from(obj.getElementsByTagName('v:shape'));
      for (const shape of shapes) {
        const title = shape.getAttribute('o:title') || '';
        // If the shape has an equation title/text, insert a text run
        if (title && !title.startsWith('Equation')) {
          const run = doc.createElement('w:r');
          const t = doc.createElement('w:t');
          t.setAttribute('xml:space', 'preserve');
          t.textContent = ` $${title}$ `;
          run.appendChild(t);
          obj.parentNode?.insertBefore(run, obj);
        }
      }
      // Remove the w:object to avoid Mammoth converting its inner imagedata
      obj.parentNode?.removeChild(obj);
    }
  }

  // 3. Convert all <m:oMath> and <m:oMathPara> into <w:r><w:t> $latex$ </w:t></w:r>
  const mathParas = Array.from(doc.getElementsByTagName('m:oMathPara'));
  for (const mathPara of mathParas) {
    const maths = Array.from(mathPara.getElementsByTagName('m:oMath'));
    const parts = maths.map(m => ommlToLatex(m).trim()).filter(Boolean);
    if (parts.length > 0) {
      const latex = parts.join(' ');
      convertedEquationCount++;
      const run = doc.createElement('w:r');
      const t = doc.createElement('w:t');
      t.setAttribute('xml:space', 'preserve');
      t.textContent = ` $${latex}$ `;
      run.appendChild(t);
      mathPara.parentNode?.replaceChild(run, mathPara);
    }
  }

  const standaloneMaths = Array.from(doc.getElementsByTagName('m:oMath'));
  for (const math of standaloneMaths) {
    if (!math.parentNode) continue;
    const rawLatex = ommlToLatex(math).trim();
    if (rawLatex) {
      convertedEquationCount++;
      const run = doc.createElement('w:r');
      const t = doc.createElement('w:t');
      t.setAttribute('xml:space', 'preserve');
      t.textContent = ` $${rawLatex}$ `;
      run.appendChild(t);
      math.parentNode.replaceChild(run, math);
    }
  }

  // Re-serialize XML and write back to zip
  const serializer = new XMLSerializer();
  const newXmlText = serializer.serializeToString(doc);
  zip.file('word/document.xml', newXmlText);

  const newBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });

  return { buffer: newBuffer, convertedEquationCount };
}
