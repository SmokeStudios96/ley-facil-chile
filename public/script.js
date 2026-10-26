// script.js
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

// Registro de Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('SW no registrado:', err);
    });
  });
}

function formatLegalText(rawText) {
  if (!rawText) return '';
  let safeText = rawText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  safeText = safeText.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>');
  safeText = safeText.replace(/^[\*\-]\s+(.*)$/gm, '<span class="text-[#00df82]">✦</span> $1');
  return safeText.replace(/\n/g, '<br>');
}

function appendMessage(sender, text, isUser = false) {
  const wrapper = document.createElement('div');
  wrapper.className = `flex gap-2.5 max-w-[92%] sm:max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : ''}`;

  const avatar = document.createElement('div');
  avatar.className = `w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-mono font-bold ${
    isUser ? 'bg-zinc-800 text-zinc-300' : 'bg-[#00df82] text-black shadow-[0_0_10px_rgba(0,223,130,0.2)]'
  }`;
  avatar.textContent = isUser ? 'Tú' : 'LF';

  const bubble = document.createElement('div');
  bubble.className = `p-3.5 text-xs sm:text-sm leading-relaxed break-words rounded-2xl ${
    isUser 
      ? 'bg-[#022116] border border-[#00df82]/40 text-white rounded-tr-sm' 
      : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-sm'
  }`;
  
  if (isUser) {
    bubble.textContent = text;
  } else {
    bubble.innerHTML = formatLegalText(text);
  }

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  chatMessages.appendChild(wrapper);
  
  chatMessages.scrollTo({
    top: chatMessages.scrollHeight,
    behavior: 'smooth'
  });
}

async function handleUserSubmit(event) {
  if (event) event.preventDefault();
  const query = userInput.value.trim();
  if (!query) return;

  appendMessage('Usuario', query, true);
  userInput.value = '';
  userInput.disabled = true;
  sendBtn.disabled = true;

  appendMessage('Ley Fácil', 'Consultando el Código del Trabajo y la base legal chilena...', false);
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

function resetChat() {
  chatMessages.innerHTML = `
    <div class="flex gap-2.5 max-w-[92%] sm:max-w-[85%]">
      <div class="w-7 h-7 rounded-lg bg-[#00df82] text-black font-bold flex-shrink-0 flex items-center justify-center text-xs shadow-sm">LF</div>
      <div class="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-sm p-3.5 text-xs sm:text-sm text-zinc-200 leading-relaxed break-words">
        <p class="font-bold text-white">¡Chat reiniciado!</p>
        <p class="text-zinc-400">¿Qué duda legal tienes hoy sobre trabajo, arriendo, compras o familia?</p>
      </div>
    </div>
  `;
}

window.handleUserSubmit = handleUserSubmit;
window.handleQuickQuestion = handleQuickQuestion;
window.resetChat = resetChat;