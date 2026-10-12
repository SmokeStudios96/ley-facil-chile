import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// 1. Lectura segura desde .env.local
function obtenerVariablesEntorno() {
  const envPath = fs.existsSync('.env.local') ? '.env.local' : fs.existsSync('.env') ? '.env' : null;
  if (!envPath) return {};
  
  const lineas = fs.readFileSync(envPath, 'utf-8').split('\n');
  const env = {};
  for (const l of lineas) {
    const trimmed = l.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [k, ...v] = trimmed.split('=');
    if (k && v.length) {
      env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

const env = obtenerVariablesEntorno();
let rawUrl = (process.env.SUPABASE_URL || env.SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '').trim();

// Limpieza automática: extrae solo el dominio base (elimina /rest/v1 o barras accidentales)
let SUPABASE_URL = '';
try {
  const parsed = new URL(rawUrl);
  SUPABASE_URL = parsed.origin; // Garantiza https://xxxxxx.supabase.co
} catch (e) {
  SUPABASE_URL = rawUrl;
}

console.log(`🔌 Conectando a Supabase en: ${SUPABASE_URL}`);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Falta SUPABASE_URL o SUPABASE_ANON_KEY en tu .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const dir = path.resolve('leyes_json');

async function subirTodasLasLeyes() {
  console.log(`🚀 Iniciando transferencia masiva de leyes oficiales...\n`);

  const archivos = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

  for (const archivo of archivos) {
    const rawData = fs.readFileSync(path.join(dir, archivo), 'utf-8');
    const ley = JSON.parse(rawData);

    if (!ley.articulos || ley.articulos.length === 0) continue;

    console.log(`📦 Subiendo [${ley.categoria}] ${ley.nombre} (${ley.articulos.length} artículos)...`);

    const filas = ley.articulos.map(art => ({
      categoria: ley.categoria,
      tema: `${art.articulo} de ${ley.nombre.replace(/_/g, ' ')}: ${art.texto.substring(0, 250)}`,
      articulo_referencia: `${art.articulo} (${ley.nombre.replace(/_/g, ' ')})`,
      texto_legal: art.texto,
      explicacion_simple: art.texto.length > 300 ? art.texto.substring(0, 300) + '...' : art.texto,
      consejo_practico: `Norma oficial de la BCN aplicable en materias de ${ley.categoria.toLowerCase()}.`
    }));

    // Lotes de 30 artículos por envío
    const TAMANO_LOTE = 30;
    for (let i = 0; i < filas.length; i += TAMANO_LOTE) {
      const lote = filas.slice(i, i + TAMANO_LOTE);
      const { error } = await supabase.from('leyes_chile').insert(lote);

      if (error) {
        console.error(`\n❌ Error en lote de ${ley.nombre}:`, error.message);
      } else {
        process.stdout.write('🟢');
      }
    }

    console.log(`\n✅ ¡${ley.nombre} transferido exitosamente a Supabase!\n`);
  }

  console.log(`🎉 ¡Carga completa! Tu base de datos quedó con toda la legislación oficial de Chile.`);
}

subirTodasLasLeyes();