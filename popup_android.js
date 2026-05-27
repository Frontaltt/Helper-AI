const providers = {
  qwen: { 
    url: "https://router.huggingface.co/v1/chat/completions", 
    model: "Qwen/Qwen2.5-72B-Instruct", 
    prefix: "hf_" 
  }
};

const locales = {
  en: { sum: "Summary", set: "⚙️", save: "Save Settings", empty: "🔑 Key is empty", valid: "✅ Valid! Autosaved.", unknown: "⚠️ Unknown format. Click Save." },
  ru: { sum: "Пересказ", set: "⚙️", save: "Сохранить", empty: "🔑 Поле пустое", valid: "✅ Корректно! Сохранено.", unknown: "⚠️ Нетипичный формат. Нажмите Сохранить." }
};

let currentLang = 'en';

document.addEventListener('DOMContentLoaded', async () => {
  // Логика переключения двух вкладок: Сжатие и Настройки
  document.querySelectorAll('.tab-btn').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });

  // Загрузка сохранённого ключа и языка
  const data = await chrome.storage.local.get(['apiKey', 'uiLang', 'contextText']);
  currentLang = data.uiLang || 'en';
  document.getElementById('ui-lang').value = currentLang;
  applyLanguage(currentLang);

  if (data.apiKey) {
    document.getElementById('api-key').value = data.apiKey.trim();
    validateKey(data.apiKey, false);
  }

  document.getElementById('paste-api-key').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      const apiKeyInput = document.getElementById('api-key');
      apiKeyInput.value = text;
      apiKeyInput.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err);
    }
  });

  document.getElementById('api-key').addEventListener('input', (e) => validateKey(e.target.value, true));
  
  document.getElementById('ui-lang').addEventListener('change', (e) => {
    currentLang = e.target.value;
    chrome.storage.local.set({ uiLang: currentLang });
    applyLanguage(currentLang);
  });

  document.getElementById('save-settings').addEventListener('click', () => {
    const rawKey = document.getElementById('api-key').value;
    chrome.storage.local.set({ apiKey: rawKey.trim(), aiProvider: 'qwen' }, () => {
      alert(currentLang === 'ru' ? 'Сохранено!' : 'Saved!');
    });
  });

  // Если текст прилетел из контекстного меню (ПКМ)
  if (data.contextText) {
    document.getElementById('sum-input').value = data.contextText;
    requestAI();
    chrome.storage.local.remove(['contextText']);
  }

  document.getElementById('btn-sum').addEventListener('click', () => requestAI());
});

function validateKey(key, shouldSave) {
  const el = document.getElementById('key-status');
  const clean = key.trim();
  if (!clean) { el.innerText = locales[currentLang].empty; el.className = "key-status status-empty"; return; }
  
  const isValid = clean.startsWith("hf_");
  el.innerText = isValid ? locales[currentLang].valid : locales[currentLang].unknown;
  el.className = isValid ? "key-status status-valid" : "key-status status-unknown";
  if (isValid && shouldSave) chrome.storage.local.set({ apiKey: clean, aiProvider: 'qwen' });
}

function applyLanguage(lang) {
  const t = locales[lang];
  document.getElementById('tab-sum').innerText = t.sum;
  document.getElementById('save-settings').querySelector('span').innerText = t.save;
}

async function requestAI() {
  const storage = await chrome.storage.local.get(['apiKey']);
  const activeKey = storage.apiKey ? storage.apiKey.trim() : document.getElementById('api-key').value.trim();
  
  if (!activeKey) return alert(currentLang === 'ru' ? 'Нет API ключа!' : 'No API Key!');
  
  const out = document.getElementById('sum-output');
  const val = document.getElementById('sum-input').value;
  if (!val) return;
  
  out.classList.remove('hidden');
  out.innerText = currentLang === 'ru' ? "⚡ Анализ текста..." : "⚡ Analyzing text...";
  
  const pmp = "Ты — ИИ, профессионально сжимающий текст. Сделай краткую, структурированную выжимку самого главного. Используй списки, если это уместно.";

  try {
    const config = providers.qwen;
    const res = await fetch(config.url, { 
      method: "POST", 
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${activeKey}`
      }, 
      body: JSON.stringify({ 
        model: config.model, 
        messages: [
          { role: "system", content: pmp }, 
          { role: "user", content: val }
        ]
      }) 
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || errData?.error || `HTTP ${res.status}`);
    }

    const r = await res.json();
    
    // Твой оригинальный рабочий парсинг ответов черезchoices
    if (r && r.choices && r.choices[0] && r.choices[0].message) {
      out.innerText = r.choices[0].message.content.trim();
    } else if (r.error) {
      out.innerText = "Error: " + (r.error.message || r.error);
    } else {
      out.innerText = "Unexpected API response structure.";
    }
  } catch (e) { 
    out.innerText = "Error: " + e.message; 
  }
}
