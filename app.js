const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
require("dotenv").config()

const BOT_TOKEN = process.env.token; // o'zingizning tokenni kiriting
const QUESTIONS = JSON.parse(fs.readFileSync('questions.json', 'utf-8'));
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const userStates = new Map();

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

  sendQuestion(userId);
});

// Savol yuborish
function sendQuestion(userId) {
  const state = userStates.get(userId);
  if (!state) return;

  const questionObj = QUESTIONS[state.index];
  if (!questionObj) return showResult(userId);

  const options = {
    type: 'quiz',
    is_anonymous: false,
    correct_option_id: questionObj.javob.findIndex(j => j.isTrue),
    open_period: 30
  };

  const choices = questionObj.javob.map(j => j.value);

  bot.sendPoll(userId, questionObj.savol, choices, options).then(pollMsg => {
    // 30 soniyadan keyin javob bo‘lmasa o‘tkazib yuborish
    const timeout = setTimeout(() => {
      state.answers.push({
        selected: null,
        correct: options.correct_option_id,
        is_correct: false
      });
      state.index++;
      bot.sendMessage(userId, '⏰ Javob bermadingiz. Keyingi savolga o‘tamiz.');
      sendQuestion(userId);
    }, 31000); // 31s (poll yopilgandan keyin)

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

// Restart
bot.on('message', (msg) => {
  if (msg.text === '🔁 Qaytadan boshlash') {
    userStates.delete(msg.from.id);
    bot.sendMessage(msg.chat.id, 'Test qaytadan boshlandi!');
    userStates.set(msg.from.id, {
      index: 0,
      score: 0,
      total: QUESTIONS.length,
      answers: [],
      timeout: null
    });
    sendQuestion(msg.from.id);
  }
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
