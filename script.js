const API_BASE = 'https://equran.id/api/v2';

const state = {
  suratList: [],
  selectedSurat: null,
  selectedSuratData: null,
  activeTab: 'quran',
  mentorMode: 'tebak',
  score: 0,
  currentQuestion: null,
  questionAnswered: false,
  audioPlayer: null,
  currentAudioUrl: null,
};

document.addEventListener('DOMContentLoaded', () => {
  bindNavigation();
  bindMentorModes();
  loadSuratList();
  renderMentorPanel();
});

function bindNavigation() {
  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const nextTab = button.dataset.tab;
      state.activeTab = nextTab;
      showTab(nextTab);
    });
  });
}

function bindMentorModes() {
  document.querySelectorAll('.mode-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const nextMode = button.dataset.mode;
      state.mentorMode = nextMode;
      document.querySelectorAll('.mode-btn').forEach((item) => {
        item.classList.toggle('active', item.dataset.mode === nextMode);
      });
      renderMentorPanel();
    });
  });
}

function showTab(tabName) {
  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tabName);
  });

  document.querySelectorAll('.panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `${tabName}-panel`);
  });

  if (tabName === 'mentor') {
    renderMentorPanel();
  }
}

async function loadSuratList() {
  setStatus('quranStatus', 'Memuat daftar surat...', 'loading');

  try {
    const response = await fetch(`${API_BASE}/surat`);
    if (!response.ok) {
      throw new Error(`Status ${response.status}`);
    }

    const result = await response.json();
    const list = Array.isArray(result.data) ? result.data : [];

    if (!list.length) {
      throw new Error('Data surat kosong dari API.');
    }

    state.suratList = list;
    renderSuratList();
    setStatus('quranStatus', `Berhasil memuat ${list.length} surat.`, 'success');
  } catch (error) {
    setStatus('quranStatus', `Gagal memuat daftar surat. Periksa koneksi internet atau coba lagi nanti.`, 'error');
    console.error(error);
  }
}

function renderSuratList() {
  const suratList = document.getElementById('suratList');
  suratList.innerHTML = '';

  state.suratList.forEach((surat) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'surat-item';
    button.dataset.nomor = String(surat.nomor);
    button.innerHTML = `
      <strong>${surat.nomor}. ${surat.namaLatin}</strong>
      <small>${surat.jumlahAyat} ayat</small>
    `;

    if (state.selectedSurat && state.selectedSurat.nomor === surat.nomor) {
      button.classList.add('active');
    }

    button.addEventListener('click', () => selectSurat(surat.nomor));
    suratList.appendChild(button);
  });
}

async function selectSurat(nomor) {
  const surat = state.suratList.find((item) => item.nomor === Number(nomor));
  if (!surat) {
    return;
  }

  stopCurrentAudio();
  state.selectedSurat = surat;
  renderSuratList();
  setStatus('quranStatus', `Memuat surat ${surat.namaLatin}...`, 'loading');

  try {
    const response = await fetch(`${API_BASE}/surat/${nomor}`);
    if (!response.ok) {
      throw new Error(`Status ${response.status}`);
    }

    const result = await response.json();
    const data = result && result.data ? result.data : null;

    if (!data || !Array.isArray(data.ayat)) {
      throw new Error('Struktur data surat tidak valid.');
    }

    state.selectedSuratData = data;
    renderSuratDetail();
    setStatus('quranStatus', `Surat ${data.namaLatin} berhasil dimuat.`, 'success');
    renderMentorPanel();
  } catch (error) {
    state.selectedSuratData = null;
    renderSuratDetail();
    setStatus('quranStatus', `Gagal memuat surat ${surat.namaLatin}. Periksa jaringan atau coba lagi.`, 'error');
    console.error(error);
  }
}

function renderSuratDetail() {
  const container = document.getElementById('suratDetail');

  if (!state.selectedSuratData) {
    stopCurrentAudio();
    container.className = 'surat-detail empty';
    container.innerHTML = '<p>Pilih surat untuk melihat ayat.</p>';
    return;
  }

  const { nama, namaLatin, arti, tempatTurun, jumlahAyat, ayat, audioFull } = state.selectedSuratData;
  const audioUrl = getAvailableAudioUrl(audioFull);

  container.className = 'surat-detail';
  container.innerHTML = `
    <div class="surat-head">
      <div class="surat-head-row">
        <h2 class="surat-title">${namaLatin}</h2>
        ${audioUrl ? `<button class="audio-btn" type="button" data-audio-url="${audioUrl}">▶ Putar Audio Surat</button>` : ''}
      </div>
      <p class="surat-meta">${nama} • ${arti} • ${jumlahAyat} ayat • ${tempatTurun}</p>
    </div>
    <div class="ayat-list">
      ${ayat
        .map(
          (item) => `
            <article class="ayat-card">
              <div class="ayat-header">
                <span class="ayat-number">${item.nomorAyat}</span>
              </div>
              <p class="ayat-arab">${item.teksArab}</p>
              <p class="ayat-translation">${item.teksIndonesia || 'Terjemahan tidak tersedia.'}</p>
            </article>
          `
        )
        .join('')}
    </div>
  `;

  const audioButton = document.querySelector('.audio-btn');
  if (audioButton) {
    audioButton.addEventListener('click', () => toggleSuratAudio(audioButton.dataset.audioUrl, audioButton));
  }
}

function getAvailableAudioUrl(audioData) {
  if (!audioData || typeof audioData !== 'object') {
    return null;
  }

  const values = Object.values(audioData);
  return values.find((value) => typeof value === 'string' && value.trim()) || null;
}

function toggleSuratAudio(audioUrl, button) {
  if (!audioUrl) {
    return;
  }

  if (state.audioPlayer && state.currentAudioUrl === audioUrl) {
    if (state.audioPlayer.paused) {
      state.audioPlayer.play();
      button.classList.add('is-playing');
      button.textContent = '⏸ Jeda Audio';
    } else {
      state.audioPlayer.pause();
      button.classList.remove('is-playing');
      button.textContent = '▶ Putar Audio Surat';
    }
    return;
  }

  stopCurrentAudio();

  const audio = new Audio(audioUrl);
  state.audioPlayer = audio;
  state.currentAudioUrl = audioUrl;

  audio.addEventListener('ended', () => {
    const activeButton = document.querySelector('.audio-btn');
    if (activeButton) {
      activeButton.textContent = '▶ Putar Audio Surat';
      activeButton.classList.remove('is-playing');
    }
    state.currentAudioUrl = null;
    state.audioPlayer = null;
  });

  audio.play().catch(() => {
    const activeButton = document.querySelector('.audio-btn');
    if (activeButton) {
      activeButton.textContent = '▶ Putar Audio Surat';
      activeButton.classList.remove('is-playing');
    }
    state.currentAudioUrl = null;
    state.audioPlayer = null;
  });

  if (button) {
    button.textContent = '⏸ Jeda Audio';
    button.classList.add('is-playing');
  }
}

function stopCurrentAudio() {
  if (!state.audioPlayer) {
    return;
  }

  state.audioPlayer.pause();
  state.audioPlayer.currentTime = 0;
  state.audioPlayer = null;
  state.currentAudioUrl = null;

  const activeButton = document.querySelector('.audio-btn');
  if (activeButton) {
    activeButton.textContent = '▶ Putar Audio Surat';
    activeButton.classList.remove('is-playing');
  }
}

function renderMentorPanel() {
  const panel = document.getElementById('mentorContent');

  if (!state.selectedSuratData || !state.selectedSuratData.ayat || !state.selectedSuratData.ayat.length) {
    panel.innerHTML = `
      <div class="mentor-empty">
        Pilih surat di menu <strong>Al-Qur’an</strong> terlebih dahulu agar Mentor Murajaah bisa menggunakan data ayat yang valid.
      </div>
    `;
    return;
  }

  if (state.selectedSuratData.ayat.length < 4) {
    panel.innerHTML = `
      <div class="mentor-warning">
        Surat <strong>${state.selectedSuratData.namaLatin}</strong> hanya memiliki ${state.selectedSuratData.ayat.length} ayat. Pilih surat lain yang punya minimal 4 ayat agar pilihan jawaban tidak ambigu.
      </div>
    `;
    return;
  }

  generateMentorQuestion();

  if (!state.currentQuestion) {
    panel.innerHTML = '<div class="mentor-empty">Soal belum tersedia.</div>';
    return;
  }

  if (state.currentQuestion.invalid) {
    panel.innerHTML = `
      <div class="mentor-warning">
        ${state.currentQuestion.message}
      </div>
    `;
    return;
  }

  const questionText =
    state.mentorMode === 'tebak'
      ? 'Tebak nomor ayat yang benar.'
      : 'Pilih ayat yang tepat menyusul ayat di atas.';

  const optionMarkup = state.currentQuestion.options
    .map((option, index) => `
      <button
        class="answer-option"
        type="button"
        data-answer-index="${index}"
      >
        ${escapeHtml(String(option))}
      </button>
    `)
    .join('');

  panel.innerHTML = `
    <div class="question-box">
      <p class="question-label">${questionText}</p>
      <p class="question-ayat">${state.currentQuestion.prompt}</p>
    </div>

    <div class="answer-list">
      ${optionMarkup}
    </div>

    <div class="action-bar">
      <button class="action-btn" id="nextQuestionBtn" type="button" ${state.questionAnswered ? '' : 'disabled'}>Soal Berikutnya</button>
      <button class="action-btn secondary" id="restartMentorBtn" type="button">Mulai Lagi</button>
    </div>
  `;

  document.querySelectorAll('.answer-option').forEach((button) => {
    button.addEventListener('click', () => handleAnswer(Number(button.dataset.answerIndex)));
  });

  document.getElementById('nextQuestionBtn').addEventListener('click', () => {
    generateMentorQuestion();
    renderMentorPanel();
  });

  document.getElementById('restartMentorBtn').addEventListener('click', () => {
    state.score = 0;
    updateScore();
    state.questionAnswered = false;
    generateMentorQuestion();
    renderMentorPanel();
  });

  updateScore();
}

function generateMentorQuestion() {
  const ayatList = state.selectedSuratData.ayat;
  if (!ayatList || ayatList.length < 4) {
    state.currentQuestion = {
      invalid: true,
      message: `Jumlah ayat pada surat ini kurang dari empat. Pilih surat lain agar soal tidak ambigu.`,
    };
    state.questionAnswered = false;
    return;
  }

  if (state.mentorMode === 'tebak') {
    const correctIndex = randomInt(0, ayatList.length - 1);
    const correctNumber = ayatList[correctIndex].nomorAyat;
    const wrongNumbers = pickUniqueValues(
      ayatList
        .map((item) => item.nomorAyat)
        .filter((number) => number !== correctNumber),
      2
    );

    const options = shuffleArray([String(correctNumber), ...wrongNumbers.map(String)]);
    state.currentQuestion = {
      type: 'tebak',
      prompt: ayatList[correctIndex].teksArab,
      correctAnswer: String(correctNumber),
      options,
      correctIndex: options.indexOf(String(correctNumber)),
      invalid: false,
    };
  } else {
    const correctIndex = randomInt(0, ayatList.length - 2);
    const correctText = ayatList[correctIndex + 1].teksArab;
    const allTexts = ayatList
      .map((item) => item.teksArab)
      .filter((text, index) => index !== correctIndex + 1 && index !== correctIndex);
    const wrongTexts = pickUniqueValues(allTexts, 2);
    const options = shuffleArray([correctText, ...wrongTexts]);

    state.currentQuestion = {
      type: 'sambung',
      prompt: ayatList[correctIndex].teksArab,
      correctAnswer: correctText,
      options,
      correctIndex: options.indexOf(correctText),
      invalid: false,
    };
  }

  state.questionAnswered = false;
}

function handleAnswer(selectedIndex) {
  if (!state.currentQuestion || state.questionAnswered) {
    return;
  }

  const selectedValue = state.currentQuestion.options[Number(selectedIndex)];
  const isCorrect = Number(selectedIndex) === Number(state.currentQuestion.correctIndex);
  const optionButtons = document.querySelectorAll('.answer-option');

  optionButtons.forEach((button) => {
    const buttonIndex = Number(button.dataset.answerIndex);
    const shouldMarkCorrect = buttonIndex === Number(state.currentQuestion.correctIndex);

    button.disabled = true;
    button.classList.toggle('correct', shouldMarkCorrect && isCorrect);
    button.classList.toggle('wrong', buttonIndex === Number(selectedIndex) && !isCorrect);

    if (shouldMarkCorrect && isCorrect) {
      button.classList.add('correct');
    }
    if (buttonIndex === Number(selectedIndex) && !isCorrect) {
      button.classList.add('wrong');
    }
  });

  state.questionAnswered = true;
  const feedbackText = isCorrect
    ? `✅ Benar! +10 poin.`
    : `❌ Salah. Jawaban yang benar: ${escapeHtml(String(state.currentQuestion.correctAnswer))}`;

  const feedbackEl = document.createElement('div');
  feedbackEl.className = `feedback ${isCorrect ? 'correct' : 'wrong'}`;
  feedbackEl.innerHTML = feedbackText;

  const actionBar = document.querySelector('.action-bar');
  if (actionBar) {
    const existingFeedback = document.querySelector('.feedback');
    if (existingFeedback) {
      existingFeedback.remove();
    }
    actionBar.insertAdjacentElement('beforeend', feedbackEl);
  }

  if (isCorrect) {
    state.score += 10;
  }

  updateScore();
  const nextButton = document.getElementById('nextQuestionBtn');
  if (nextButton) {
    nextButton.disabled = false;
  }
}

function shuffleArray(items) {
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function pickUniqueValues(values, count) {
  const unique = [...new Set(values)];
  if (unique.length <= count) {
    return unique;
  }

  const result = [];
  const pool = [...unique];
  while (result.length < count && pool.length) {
    const index = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function updateScore() {
  const scoreEl = document.getElementById('scoreValue');
  if (scoreEl) {
    scoreEl.textContent = String(state.score);
  }
}

function setStatus(elementId, message, type) {
  const element = document.getElementById(elementId);
  if (!element) {
    return;
  }

  element.textContent = message;
  element.className = 'status visible';
  element.classList.add(type === 'loading' ? 'status-loading' : type === 'error' ? 'status-error' : 'status-success');
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
