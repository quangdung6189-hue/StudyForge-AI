import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { ommlToLatex } from '@/lib/omml-to-latex';
import { decodeMtefFromOleBuffer } from '@/lib/mtef-decoder';

/**
 * Mapping table for Word Symbol / Euclid Symbol / MT Extra font character codes (ASCII & Private Use Area 0xF000+)
 * to standard LaTeX math commands so formula fonts never degrade into ordinary text characters.
 */
const SYMBOL_FONT_LATEX_MAP: Record<number, string> = {
  // Uppercase Greek in Symbol / Euclid Symbol font
  0x41: 'A', 0x42: 'B', 0x43: '\\Chi', 0x44: '\\Delta', 0x45: 'E', 0x46: '\\Phi', 0x47: '\\Gamma',
  0x48: 'H', 0x49: 'I', 0x4b: 'K', 0x4c: '\\Lambda', 0x4d: 'M', 0x4e: 'N', 0x4f: 'O',
  0x50: '\\Pi', 0x51: '\\Theta', 0x52: 'P', 0x53: '\\Sigma', 0x54: 'T', 0x55: '\\Upsilon',
  0x57: '\\Omega', 0x58: '\\Xi', 0x59: '\\Psi', 0x5a: 'Z',
  // Lowercase Greek in Symbol / Euclid Symbol font
  0x61: '\\alpha', 0x62: '\\beta', 0x63: '\\chi', 0x64: '\\delta', 0x65: '\\varepsilon',
  0x66: '\\varphi', 0x67: '\\gamma', 0x68: '\\eta', 0x69: '\\iota', 0x6a: '\\varphi',
  0x6b: '\\kappa', 0x6c: '\\lambda', 0x6d: '\\mu', 0x6e: '\\nu', 0x6f: 'o',
  0x70: '\\pi', 0x71: '\\theta', 0x72: '\\rho', 0x73: '\\sigma', 0x74: '\\tau',
  0x75: '\\upsilon', 0x76: '\\varpi', 0x77: '\\omega', 0x78: '\\xi', 0x79: '\\psi', 0x7a: '\\zeta',
  // Operators & math symbols in Symbol font (0xA0 - 0xFE)
  0xa3: '\\le', 0xa5: '\\infty', 0xb0: '^\\circ', 0xb1: '\\pm', 0xb3: '\\ge',
  0xb4: '\\times', 0xb5: '\\propto', 0xb6: '\\partial', 0xb7: '\\cdot', 0xb8: '\\div',
  0xb9: '\\ne', 0xba: '\\equiv', 0xbb: '\\approx', 0xc4: '\\otimes', 0xc5: '\\oplus',
  0xc6: '\\emptyset', 0xc7: '\\cap', 0xc8: '\\cup', 0xc9: '\\supset', 0xca: '\\supseteq',
  0xcb: '\\not\\subset', 0xcc: '\\subset', 0xcd: '\\subseteq', 0xce: '\\in', 0xcf: '\\notin',
  0xd0: '\\angle', 0xd1: '\\nabla', 0xd6: '\\sqrt{}', 0xd7: '\\cdot',
  0xdb: '\\Leftrightarrow', 0xdc: '\\Leftarrow', 0xdd: '\\Uparrow', 0xde: '\\Rightarrow', 0xdf: '\\Downarrow',
  0xe1: '\\langle', 0xe5: '\\sum', 0xf1: '\\rangle', 0xf2: '\\int',
  0xac: '\\leftarrow', 0xad: '\\uparrow', 0xae: '\\rightarrow', 0xaf: '\\downarrow', 0xab: '\\leftrightarrow',
};

const FORMULA_FONT_REGEX = /^(?:Symbol|MT Extra|Euclid Symbol|Euclid Extra|Euclid Math One|Euclid Math Two|Wingdings 3)$/i;

function decodeSymbolFontChar(code: number): string | null {
  const normalized = code >= 0xf000 && code <= 0xf0ff ? code - 0xf000 : code;
  return SYMBOL_FONT_LATEX_MAP[normalized] ?? null;
}

/**
 * Preprocess DOCX to convert Word Equations (OMML), MathType equations, Symbol/Formula fonts,
 * and mc:AlternateContent into native Word text runs (<w:r><w:t>$LaTeX$</w:t></w:r>) before Mammoth runs.
 */
export async function preprocessDocxMathAndImages(buffer: Buffer): Promise<{
  buffer: Buffer;
  convertedEquationCount: number;
}> {
  const zip = await JSZip.loadAsync(buffer);
  const docFile = zip.file('word/document.xml');
  if (!docFile) return { buffer, convertedEquationCount: 0 };

  // Read relationships to map rId -> target media / ole object
  const relsEntry = zip.file('word/_rels/document.xml.rels');
  const relsMap = new Map<string, string>();
  if (relsEntry) {
    const relsXml = await relsEntry.async('string');
    const parser = new DOMParser({ errorHandler: { warning() {}, error() {}, fatalError() {} } });
    const relsDoc = parser.parseFromString(relsXml, 'application/xml');
    const relNodes = Array.from(relsDoc.getElementsByTagName('Relationship'));
    for (const rel of relNodes) {
      const id = rel.getAttribute('Id') || '';
      const target = rel.getAttribute('Target') || '';
      if (id && target) {
        relsMap.set(id, target.replace(/^word\//, '').replace(/^\.\.\//, ''));
      }
    }
  }

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

  // 2. Decode MathType OLE objects (<w:object>) into native LaTeX text runs
  // and discard the fallback preview shape/imagedata so Mammoth does not emit <img>
  const objects = Array.from(doc.getElementsByTagName('w:object'));
  for (const obj of objects) {
    const oleObjects = Array.from(obj.getElementsByTagName('o:OLEObject'));
    const isEquation = oleObjects.some(ole => {
      const progId = ole.getAttribute('ProgID') || '';
      return /Equation/i.test(progId);
    });

    if (isEquation) {
      let latex: string | null = null;
      for (const ole of oleObjects) {
        const rId = ole.getAttribute('r:id') || '';
        const targetPath = relsMap.get(rId);
        if (targetPath) {
          const oleFile = zip.file(`word/${targetPath}`) || zip.file(targetPath);
          if (oleFile) {
            const oleBuf = await oleFile.async('nodebuffer');
            latex = decodeMtefFromOleBuffer(oleBuf);
            if (latex) break;
          }
        }
      }

      if (latex) {
        convertedEquationCount++;
        const run = doc.createElement('w:r');
        const t = doc.createElement('w:t');
        t.setAttribute('xml:space', 'preserve');
        t.textContent = ` $${latex}$ `;
        run.appendChild(t);
        obj.parentNode?.insertBefore(run, obj);
      } else {
        const shapes = Array.from(obj.getElementsByTagName('v:shape'));
        for (const shape of shapes) {
          const title = shape.getAttribute('o:title') || '';
          if (title && !title.startsWith('Equation')) {
            const run = doc.createElement('w:r');
            const t = doc.createElement('w:t');
            t.setAttribute('xml:space', 'preserve');
            t.textContent = ` $${title}$ `;
            run.appendChild(t);
            obj.parentNode?.insertBefore(run, obj);
            convertedEquationCount++;
          }
        }
      }

      // Remove the w:object to avoid Mammoth converting its inner imagedata to [Hình N]
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

  // 4. Convert <w:sym w:font="..." w:char="..."/> elements into LaTeX runs
  const symNodes = Array.from(doc.getElementsByTagName('w:sym'));
  for (const sym of symNodes) {
    const font = sym.getAttribute('w:font') || sym.getAttribute('font') || '';
    const charHex = sym.getAttribute('w:char') || sym.getAttribute('char') || '';
    if (charHex) {
      const code = parseInt(charHex, 16);
      const latexCmd = (!font || FORMULA_FONT_REGEX.test(font)) ? decodeSymbolFontChar(code) : null;
      if (latexCmd) {
        convertedEquationCount++;
        const t = doc.createElement('w:t');
        t.setAttribute('xml:space', 'preserve');
        t.textContent = `$${latexCmd}$`;
        sym.parentNode?.replaceChild(t, sym);
      }
    }
  }

  // 5. Convert <w:r> runs that use dedicated formula/symbol fonts (Symbol, MT Extra, Euclid Symbol, etc.)
  const allRuns = Array.from(doc.getElementsByTagName('w:r'));
  for (const r of allRuns) {
    const rPr = Array.from(r.getElementsByTagName('w:rPr'))[0];
    if (!rPr) continue;
    const rFonts = Array.from(rPr.getElementsByTagName('w:rFonts'))[0];
    if (!rFonts) continue;
    const fontName = rFonts.getAttribute('w:ascii') || rFonts.getAttribute('w:hAnsi') || rFonts.getAttribute('w:cs') || '';
    if (!FORMULA_FONT_REGEX.test(fontName)) continue;

    const tNodes = Array.from(r.getElementsByTagName('w:t'));
    for (const tNode of tNodes) {
      const raw = tNode.textContent ?? '';
      if (!raw.trim()) continue;
      let mapped = '';
      let changed = false;
      for (const ch of raw) {
        const latexCmd = decodeSymbolFontChar(ch.charCodeAt(0));
        if (latexCmd) {
          mapped += ` ${latexCmd} `;
          changed = true;
        } else {
          mapped += ch;
        }
      }
      if (changed) {
        convertedEquationCount++;
        tNode.textContent = `$${mapped.replace(/\s+/g, ' ').trim()}$`;
      }
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
