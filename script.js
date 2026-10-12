// ==========================================
// LEY FÁCIL CIUDADANA - SCRIPT PRINCIPAL
// ==========================================

const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

// Función para convertir markdown simple (negritas y saltos de línea) a HTML seguro
function formatLegalText(rawText) {
  if (!rawText) return '';
  
  // Escapar caracteres peligrosos
  let safeText = rawText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Convertir **texto** en <strong>texto</strong> (negrita)
  safeText = safeText.replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-900 font-bold">$1</strong>');

  // Convertir viñetas (* o - al inicio de línea)
  safeText = safeText.replace(/^[\*\-]\s+(.*)$/gm, '• $1');

  // Convertir saltos de línea a <br>
  return safeText.replace(/\n/g, '<br>');
}

// Función para agregar un globo de mensaje al chat
function appendMessage(sender, text, isUser = false) {
  const wrapper = document.createElement('div');
  wrapper.className = `flex gap-3 max-w-[90%] sm:max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : ''}`;

  const avatar = document.createElement('div');
  avatar.className = `w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold shadow-sm ${
    isUser ? 'bg-slate-700 text-white' : 'bg-blue-600 text-white'
  }`;
  avatar.textContent = isUser ? 'Tú' : 'LF';

  const bubble = document.createElement('div');
  bubble.className = `p-3.5 shadow-sm text-xs sm:text-sm leading-relaxed break-words rounded-2xl ${
    isUser 
      ? 'bg-blue-600 text-white rounded-tr-sm' 
      : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
  }`;
  
  if (isUser) {
    bubble.textContent = text;
  } else {
    bubble.innerHTML = formatLegalText(text);
  }

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  chatMessages.appendChild(wrapper);
  
  // Desplazar suavemente hasta el final
  chatMessages.scrollTo({
    top: chatMessages.scrollHeight,
    behavior: 'smooth'
  });
}

// Envío del formulario
async function handleUserSubmit(event) {
  if (event) event.preventDefault();
  const query = userInput.value.trim();
  if (!query) return;

  // 1. Mostrar consulta del usuario
  appendMessage('Usuario', query, true);
  userInput.value = '';
  userInput.disabled = true;
  sendBtn.disabled = true;

  // 2. Indicador temporal de carga
  appendMessage('Ley Fácil', 'Consultando la base legal y redactando la respuesta en peras y manzanas...', false);
  const loadingBubble = chatMessages.lastElementChild;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: query })
    });

    const data = await res.json();
    loadingBubble.remove();

    if (res.ok && data.reply) {
      appendMessage('Ley Fácil', data.reply, false);
    } else {
      const errorMsg = data.error || 'Lo siento, no pude obtener respuesta en este momento.';
      appendMessage('Ley Fácil', `⚠️ ${errorMsg}`, false);
    }
  } catch (error) {
    loadingBubble.remove();
    appendMessage('Ley Fácil', '⚠️ Error de conexión con el servidor. Revisa tu conexión o intenta más tarde.', false);
  } finally {
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
}

// Consultas rápidas (botones de la barra superior)
function handleQuickQuestion(tema) {
  const preguntas = {
    despido: "¿Me pueden despedir por necesidades de la empresa si estoy con licencia médica?",
    arriendo: "Mi arrendador no me quiere devolver el mes de garantía, ¿qué puedo hacer?",
    pension: "¿Cómo se calcula la pensión de alimentos en Chile y qué pasa si no pagan?",
    sernac: "¿Qué es la garantía legal de 6 meses y qué opciones tengo si falla un producto?"
  };

  if (preguntas[tema]) {
    userInput.value = preguntas[tema];
    handleUserSubmit(null);
  }
}

// Limpiar historial de pantalla
function resetChat() {
  chatMessages.innerHTML = `
    <div class="flex gap-3 max-w-[90%] sm:max-w-[85%]">
      <div class="w-7 h-7 rounded-full bg-blue-600 text-white flex-shrink-0 flex items-center justify-center text-xs font-bold shadow-sm">LF</div>
      <div class="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-3.5 shadow-sm text-xs sm:text-sm text-slate-700 leading-relaxed break-words">
        <p class="font-semibold text-slate-900 mb-1">¡Chat reiniciado!</p>
        <p>¿Qué duda legal tienes hoy sobre trabajo, arriendo, compras o familia?</p>
      </div>
    </div>
  `;
}

// Exponer funciones necesarias para los onclick de index.html
window.handleUserSubmit = handleUserSubmit;
window.handleQuickQuestion = handleQuickQuestion;
window.resetChat = resetChat;