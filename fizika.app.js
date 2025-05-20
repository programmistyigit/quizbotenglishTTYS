const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const QUESTIONS = require('./data.json');
const TOKEN = process.env.BOT_TOKEN;

const bot = new TelegramBot(TOKEN, { polling: true });
const userStates = new Map();

function getRandomQuestions(n) {
    const shuffled = [...QUESTIONS].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
}

function sendQuestion(userId) {
    const state = userStates.get(userId);
    if (!state) return;

    if (state.timeout) {
        clearTimeout(state.timeout);
        state.timeout = null;
    }

    const questionObj = state.mode === '20test'
        ? state.questions[state.index]
        : QUESTIONS[state.index];

    if (!questionObj) return showResult(userId);

    const choices = questionObj.javob.map(j => j.value.slice(0, 100));
    for (let i = 0; i < choices.length; i++) {
        if (choices[i].length > 100) {
            bot.sendMessage(userId, `❌ ${state.index + 1}-savolning ${i + 1}-variantidagi matn juda uzun.`);
            state.index++;
            sendQuestion(userId);
            return;
        }
    }

    const options = {
        type: 'quiz',
        is_anonymous: false,
        correct_option_id: questionObj.javob.findIndex(j => j.isTrue),
        open_period: 30
    };

    const current = state.index + 1;
    const total = state.total;
    const correctSoFar = state.answers.filter(a => a.is_correct).length;
    const questionText = `— ${questionObj.savol} \n\n🧠 ${current}/${total} | ✅ ${correctSoFar}/${state.index}`;

    bot.sendPoll(userId, questionText, choices, options).then(pollMsg => {
        const timeout = setTimeout(() => {
            state.answers.push({
                selected: null,
                correct: options.correct_option_id,
                is_correct: false
            });
            state.index++;
            bot.sendMessage(userId, '⏰ Javob bermadingiz. Keyingi savolga o‘tamiz.');
            sendQuestion(userId);
        }, 31000);

        state.timeout = timeout;
    });
}

function showResult(userId) {
    const state = userStates.get(userId);
    if (!state) return;

    const correctAnswers = state.answers.filter(a => a.is_correct).length;
    const totalQuestions = state.total;

    bot.sendMessage(userId, `✅ Test yakunlandi!\n\nTo‘g‘ri javoblar soni: ${correctAnswers}/${totalQuestions}`);
    userStates.delete(userId);
}

bot.on('poll_answer', pollAnswer => {
    const userId = pollAnswer.user.id;
    const state = userStates.get(userId);
    if (!state) return;

    if (state.timeout) {
        clearTimeout(state.timeout);
        state.timeout = null;
    }

    const questionObj = state.mode === '20test'
        ? state.questions[state.index]
        : QUESTIONS[state.index];

    const correctOptionId = questionObj.javob.findIndex(j => j.isTrue);
    const selectedOptionId = pollAnswer.option_ids[0];

    const isCorrect = selectedOptionId === correctOptionId;
    state.answers.push({
        selected: selectedOptionId,
        correct: correctOptionId,
        is_correct: isCorrect
    });
    state.index++;

    setTimeout(() => sendQuestion(userId), 500);
});

bot.onText(/\/start/, msg => {
    const userId = msg.from.id;
    bot.sendMessage(userId, '📚 Testga xush kelibsiz!', {
        reply_markup: {
            keyboard: [
                ['🛑 To‘xtatish', '🔁 Qaytadan boshlash'],
                ['🧪 20ta Test']
            ],
            resize_keyboard: true
        }
    });
});

bot.on('message', msg => {
    const userId = msg.from.id;
    const text = msg.text;

    if (text === '🧪 20ta Test') {
        const selectedQuestions = getRandomQuestions(20);
        userStates.set(userId, {
            index: 0,
            score: 0,
            total: selectedQuestions.length,
            answers: [],
            timeout: null,
            mode: '20test',
            questions: selectedQuestions
        });

        bot.sendMessage(userId, '🧪 20 ta test boshlandi!');
        sendQuestion(userId);
        return;
    }

    if (text === '🔁 Qaytadan boshlash') {
        userStates.delete(userId);
        bot.sendMessage(userId, '♻️ Test boshqatdan boshlandi. /start ni bosing.', {
            reply_markup: {
                keyboard: [
                    ['🛑 To‘xtatish', '🔁 Qaytadan boshlash'],
                    ['🧪 20ta Test']
                ],
                resize_keyboard: true
            }
        });
        return;
    }

    if (text === '🛑 To‘xtatish') {
        userStates.delete(userId);
        bot.sendMessage(userId, '🛑 Test to‘xtatildi. /start ni bosing.', {
            reply_markup: {
                keyboard: [
                    ['🛑 To‘xtatish', '🔁 Qaytadan boshlash'],
                    ['🧪 20ta Test']
                ],
                resize_keyboard: true
            }
        });
        return;
    }
});
