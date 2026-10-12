import { XMLParser } from 'fast-xml-parser';
import fs from 'fs';
import path from 'path';

// Catálogo con los IDs oficiales verificados en BCN LeyChile
const LEYES_CHILE = [
  { id: '207436', nombre: 'codigo_del_trabajo', categoria: 'Laboral' },
  { id: '61438',  nombre: 'ley_del_consumidor_19496', categoria: 'Consumidor' },
  { id: '29526',  nombre: 'ley_de_arriendo_18101', categoria: 'Vivienda' },
  { id: '27977',  nombre: 'ley_pension_alimentos_14908', categoria: 'Familia' }
];

const outputDir = path.resolve('leyes_json');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true
});

// Decodifica entidades HTML a texto en español limpio (ej: &#237; -> í)
function decodificarHTML(str) {
  if (!str) return '';
  return str
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í').replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú')
    .replace(/&ntilde;/g, 'ñ').replace(/&Ntilde;/g, 'Ñ')
    .replace(/&deg;/g, '°').replace(/&ordm;/g, 'º')
    .replace(/\s+/g, ' ')
    .trim();
}

// Convierte de forma 100% segura cualquier objeto, número o valor a String
function aString(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (val['#text']) return String(val['#text']);
    if (Array.isArray(val)) return val.map(aString).join(' ');
    return '';
  }
  return String(val);
}

// Limpieza recursiva de bloques de texto
function limpiarTexto(nodo) {
  if (!nodo) return '';
  if (typeof nodo === 'string') return nodo;
  if (typeof nodo === 'number') return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(limpiarTexto).join(' ');
  if (typeof nodo === 'object') {
    return Object.values(nodo).map(limpiarTexto).join(' ');
  }
  return '';
}

// Extractor recursivo compatible con Códigos y Leyes especiales
function extraerArticulos(obj, lista = []) {
  if (!obj || typeof obj !== 'object') return lista;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      extraerArticulos(item, lista);
    }
    return lista;
  }

  const tipo = aString(obj['@_tipoParte'] || obj.tipoParte).toLowerCase();
  const nombre = aString(obj['@_nombreParte'] || obj.nombreParte || obj.Metadatos?.NombreParte);
  const esArticulo = tipo.includes('art') || nombre.toLowerCase().startsWith('art');

  if (obj.Texto || obj['#text']) {
    const raw = decodificarHTML(limpiarTexto(obj.Texto || obj['#text']));

    // Caso 1: El nodo es directamente un artículo
    if (esArticulo && raw.length > 10) {
      lista.push({
        articulo: nombre || raw.match(/^(Art[íi]culo\s+\d+[\w\sº°\.]*)/i)?.[1] || 'Artículo',
        texto: raw
      });
    } 
    // Caso 2: Artículos anidados o agrupados en leyes especiales
    else if (raw.includes('Artículo') || raw.includes('Art.')) {
      const fragmentos = raw.split(/(?=(?:Art[íi]culo\s+\d+|Art\.\s*\d+))/i);
      for (const frag of fragmentos) {
        const textoFrag = frag.trim();
        if (textoFrag.length > 20 && (textoFrag.startsWith('Artículo') || textoFrag.startsWith('Art.'))) {
          const matchNum = textoFrag.match(/^(Art[íi]culo\s+\d+[\w\sº°\.]*|Art\.\s*\d+[\w\sº°\.]*)/i);
          lista.push({
            articulo: matchNum ? matchNum[1].trim() : 'Artículo',
            texto: textoFrag
          });
        }
      }
    }
  }

  // Recorrer hijos (Libros, Títulos, Párrafos)
  for (const key of Object.keys(obj)) {
    if (key !== 'Texto' && typeof obj[key] === 'object') {
      extraerArticulos(obj[key], lista);
    }
  }

  return lista;
}

// Consulta con cabecera de navegador y protección anti rate-limit (429)
async function fetchConReintento(url) {
  for (let i = 0; i < 2; i++) {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/xml,text/xml,*/*'
      }
    });

    if (res.status === 429) {
      console.warn(`⏳ BCN solicitó esperar (429). Esperando 6 segundos antes de reintentar...`);
      await new Promise(r => setTimeout(r, 6000));
      continue;
    }

    return res;
  }
  throw new Error('Límite de reintentos alcanzado (429).');
}

async function ejecutarDescarga() {
  console.log(`🚀 Iniciando extracción de leyes oficiales desde BCN LeyChile...\n`);

  for (const ley of LEYES_CHILE) {
    const url = `https://www.bcn.cl/leychile/consulta/obtxml?opt=7&idNorma=${ley.id}`;
    console.log(`⬇️ Descargando [${ley.categoria}] ${ley.nombre} (ID: ${ley.id})...`);

    try {
      const response = await fetchConReintento(url);
      if (!response.ok) {
        console.error(`❌ Error HTTP ${response.status} en ${ley.nombre}`);
        continue;
      }

      const xmlText = await response.text();
      const jsonObj = parser.parse(xmlText);
      const norma = jsonObj.Norma;

      if (!norma) {
        console.warn(`⚠️ No se encontró etiqueta <Norma> para ${ley.nombre}`);
        continue;
      }

      const articulos = extraerArticulos(norma);

      // Eliminar duplicados manteniendo integridad
      const articulosUnicos = [];
      const vistos = new Set();
      for (const a of articulos) {
        const resumen = a.texto.substring(0, 50);
        if (!vistos.has(resumen)) {
          vistos.add(resumen);
          articulosUnicos.push(a);
        }
      }

      const resultado = {
        id_norma: ley.id,
        nombre: ley.nombre,
        categoria: ley.categoria,
        titulo: aString(norma.Identificador?.Titulo) || ley.nombre,
        total_articulos: articulosUnicos.length,
        articulos: articulosUnicos
      };

      const destino = path.join(outputDir, `${ley.nombre}.json`);
      fs.writeFileSync(destino, JSON.stringify(resultado, null, 2), 'utf-8');

      console.log(`✅ ¡Éxito! ${ley.nombre}: ${articulosUnicos.length} artículos guardados en leyes_json/${ley.nombre}.json\n`);

      // Pausa de 3.5 segundos entre descargas para no saturar al servidor
      await new Promise(r => setTimeout(r, 3500));

    } catch (err) {
      console.error(`❌ Error en ${ley.nombre}:`, err.message);
    }
  }

  console.log(`🎉 ¡Proceso finalizado con éxito! Todos los archivos quedaron en "leyes_json/".`);
}

ejecutarDescarga();