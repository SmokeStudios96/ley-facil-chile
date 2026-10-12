import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { message } = req.body;

  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
  }

  try {
    // 1. Buscar leyes o guías en Supabase según palabras clave
    const palabras = message.trim().split(/\s+/).filter(w => w.length > 3).join(' | ');
    
    let contextoLeyes = "";
    if (palabras.length > 0) {
      const { data: articulos } = await supabase
        .from('leyes_chile')
        .select('categoria, tema, articulo_referencia, explicacion_simple, consejo_practico')
        .textSearch('tema', palabras, { config: 'spanish', type: 'websearch' })
        .limit(3);

      if (articulos && articulos.length > 0) {
        contextoLeyes = articulos.map(a => 
          `[Categoría: ${a.categoria}] Tema: ${a.tema} (${a.articulo_referencia})\nExplicación: ${a.explicacion_simple}\nConsejo: ${a.consejo_practico}`
        ).join("\n\n");
      }
    }

    // 2. Prompt del sistema orientado a lenguaje ciudadano chileno
    const systemPrompt = `
Eres un asistente legal ciudadano para Chile llamado "Ley Fácil".
Tu objetivo: Traducir conceptos jurídicos a un lenguaje simple, cercano y directo ("en peras y manzanas").
Público: Personas que no saben de leyes o que tienen dudas con lo que les dijo un abogado.

Reglas obligatorias:
1. Explica sin tecnicismos innecesarios. Si usas un término legal, tradúcelo de inmediato.
2. Da siempre un "Paso Práctico" (dónde acudir: Inspección del Trabajo, SERNAC, Juzgado de Policía Local, Corporación de Asistencia Judicial CAJ, etc.).
3. Si aplica despido, recuerda siempre la 'Reserva de Derechos' en el finiquito.
4. Recuerda de forma sutil que esto es una orientación educativa y no sustituye el patrocinio de un abogado formal.

Información de apoyo disponible en la base de datos:
${contextoLeyes || "No hay artículos exactos en la base de datos, usa la legislación vigente en Chile."}
`;

    // 3. Consulta al modelo LLM
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Rápido y muy económico
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      temperature: 0.3
    });

    const reply = completion.choices[0].message.content;
    return res.status(200).json({ reply });

  } catch (error) {
    console.error("Error en API:", error);
    return res.status(500).json({ error: "Ocurrió un error al procesar tu consulta." });
  }
}