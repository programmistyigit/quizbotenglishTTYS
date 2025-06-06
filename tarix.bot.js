const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
require("dotenv").config()

const BOT_TOKEN = process.env.tarix_bot_api; // o'zingizning tokenni kiriting

const QUESTIONS = JSON.parse(fs.readFileSync('tarix.json', 'utf-8'));
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const userStates = new Map();
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Boshlash
bot.onText(/\/start/, (msg) => {
    const userId = msg.from.id;
    userStates.set(userId, {
        index: 0,
        score: 0,
        total: QUESTIONS.length,
        answers: [],
        timeout: null
    });
    bot.sendMessage(userId, 'Test boshlandi! Quyidagi tugmalar yordamida testni to‘xtatishingiz yoki qayta boshlashingiz mumkin.', {
        reply_markup: {
            keyboard: [
                ['🛑 To‘xtatish', '🔁 Qaytadan boshlash']
            ],
            resize_keyboard: true
        }
    }).then(() => {
        sendQuestion(userId);
    });
});

// Savol yuborish
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function sendQuestion(userId) {
    const state = userStates.get(userId);
    if (!state) return;

    if (state.timeout) {
        clearTimeout(state.timeout);
        state.timeout = null;
    }

    const questionObj = QUESTIONS[state.index];
    if (!questionObj) return showResult(userId);

    // Javoblarni nusxalab olamiz
    const shuffledAnswers = [...questionObj.javob];
    shuffleArray(shuffledAnswers);  // aralashtiramiz

    // To'g'ri javobning yangi indeksi
    const correct_option_id = shuffledAnswers.findIndex(j => j.isTrue);

    const options = {
        type: 'quiz',
        is_anonymous: false,
        correct_option_id: correct_option_id,
        open_period: 30
    };

    const choices = shuffledAnswers.map(j => j.value.slice(0, 100));

    const current = state.index + 1;
    const total = state.total;
    const correctSoFar = state.answers.filter(a => a.is_correct).length;

    const questionText = `— ${questionObj.savol} 🧠 ${current}/${total} | ✅ ${correctSoFar}/${state.index}`;

    bot.sendPoll(userId, questionText, choices, options).then(pollMsg => {
        state.timeout = null;
        const timeout = setTimeout(() => {
            state.answers.push({
                selected: null,
                correct: correct_option_id,
                is_correct: false
            });
            state.index++;
            bot.sendMessage(userId, '⏰ Javob bermadingiz. Keyingi savolga o‘tamiz.');
            sendQuestion(userId);
        }, 31000);

        state.timeout = timeout;
    });
}


// Poll natijasi
bot.on('poll_answer', (pollAnswer) => {
    const userId = pollAnswer.user.id;
    const state = userStates.get(userId);
    if (!state) return;

    clearTimeout(state.timeout); // timeoutni to‘xtatamiz

    const currentQuestion = QUESTIONS[state.index];
    const correctIndex = currentQuestion.javob.findIndex(j => j.isTrue);
    const selected = pollAnswer.option_ids[0];

    const isCorrect = selected === correctIndex;
    if (isCorrect) state.score++;

    state.answers.push({ selected, correct: correctIndex, is_correct: isCorrect });
    state.index++;
    sendQuestion(userId);
});


// Natija
function showResult(userId) {
    const state = userStates.get(userId);
    if (!state) return;

    const text = `✅ Test tugadi!\n\nSizning natijangiz: ${state.score} / ${state.total}`;
    bot.sendMessage(userId, text, {
        reply_markup: {
            keyboard: [['🔁 Qaytadan boshlash']],
            resize_keyboard: true
        }
    });
}

bot.onText(/\/stop/, (msg) => {
    const userId = msg.from.id;
    const state = userStates.get(userId);
    if (state) {
        if (state.timeout) clearTimeout(state.timeout);
        userStates.delete(userId);
        bot.sendMessage(userId, '🛑 Test to‘xtatildi. Qayta boshlash uchun /start yozing.');
    } else {
        bot.sendMessage(userId, 'Sizda hozircha aktiv test yo‘q.');
    }
});

bot.on('message', (msg) => {
    const text = msg.text
    const userId = msg.from.id;
    
    // ✅ Testni to‘xtatish
    if (text == '🛑 To‘xtatish') {
        const state = userStates.get(userId);
        if (state) {
            if (state.timeout) clearTimeout(state.timeout);
            userStates.delete(userId);
            bot.sendMessage(userId, '🛑 Test to‘xtatildi. Qayta boshlash uchun /start yozing.');
        } else {
            bot.sendMessage(userId, text+'Sizda hozircha aktiv test yo‘q.');
        }
        return;
    }

    // 🔁 Qayta boshlash
    if (text == '🔁 Qaytadan boshlash') {
    const oldState = userStates.get(userId);
    if (oldState && oldState.timeout) {
        clearTimeout(oldState.timeout); // eski timeoutni tozalaymiz
    }

    userStates.delete(userId);
    bot.sendMessage(userId, 'Test qayta boshlandi!');
    userStates.set(userId, {
        index: 0,
        score: 0,
        total: QUESTIONS.length,
        answers: [],
        timeout: null
    });
    sendQuestion(userId);
}
});
