import {Telegraf, Markup} from 'telegraf';
import {Low} from 'lowdb';
import {JSONFile} from 'lowdb/node';
import dotenv from 'dotenv';
import fs from 'fs';
import {getWinnerStats, getAnswerStats, printAnalytics} from './analytics.js';

dotenv.config();

// База для результатов

// создаём файл, если его нет
if (!fs.existsSync('./data/results.json')) {
    fs.writeFileSync('./data/results.json', JSON.stringify({results: []}, null, 2));
}

const adapter = new JSONFile('./data/results.json');
const db = new Low(adapter, {results: []});

await db.read();
db.data ||= {results: []}; // теперь безопасно

// Загружаем вопросы и философов
const questions = JSON.parse(fs.readFileSync('./data/questions.json', 'utf8'));
const philosophers = JSON.parse(fs.readFileSync('./data/philosophers.json', 'utf8'));

const bot = new Telegraf(process.env.BOT_TOKEN);
const sessions = new Map();

// Старт
bot.start((ctx) => {
    ctx.reply(
        'Привет! 🦒\nХочешь узнать, какой ты философ?',
        Markup.inlineKeyboard([
            [Markup.button.callback('Да, поехали!', 'start_quiz')],
            [Markup.button.callback('Я уже философ.', 'already')]
        ])
    );
});

bot.action('already', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('Тем интереснее — сверим показания!');
    startQuiz(ctx);
});

bot.action('start_quiz', (ctx) => {
    ctx.answerCbQuery();
    startQuiz(ctx);
});

// Запуск квиза
function startQuiz(ctx) {
    const scores = {};
    for (const p of philosophers) scores[p.id] = 0;

    sessions.set(ctx.chat.id, {
        index: 0,
        scores,
        answers: []
    });

    sendQuestion(ctx);
}

// Отправка вопроса
function sendQuestion(ctx) {
    const session = sessions.get(ctx.chat.id);
    const q = questions[session.index];

    ctx.reply(
        `Вопрос ${session.index + 1}/${questions.length}\n${q.question}`,
        Markup.inlineKeyboard(
            q.options.map(opt => [Markup.button.callback(opt.text, opt.value)])
        )
    );
}

// Обработка ответов
bot.on('callback_query', async (ctx) => {
    const session = sessions.get(ctx.chat.id);
    if (!session) return;

    const q = questions[session.index];
    const answer = ctx.callbackQuery.data;

    // Сохраняем выбранный вариант
    session.answers.push({questionId: q.id, value: answer});

    const choice = q.options.find(o => o.value === answer);
    if (choice) {
        for (const ph of choice.philosophers) {
            session.scores[ph] = (session.scores[ph] || 0) + 1;
        }
    }

    session.index++;
    ctx.answerCbQuery();

    if (session.index < questions.length) {
        sendQuestion(ctx);
    } else {
        await showResult(ctx);
        sessions.delete(ctx.chat.id);
    }
});

async function showResult(ctx) {
    ctx.reply('Готово!\nСекундочку... сверяю твои ответы с древними свитками 🤓');

    const session = sessions.get(ctx.chat.id);
    const sorted = Object.entries(session.scores).sort((a, b) => b[1] - a[1]);
    const top = sorted[0][0];
    const philosopher = philosophers.find(p => p.id === top);

    const resultText = `
${philosopher.emoji} ${philosopher.name}
${philosopher.description}

💬 ${philosopher.quote}
`;

    await new Promise(res => setTimeout(res, 1500)); // эффект ожидания

    // Отправляем результат с кнопкой "Узнать статистику"

    ctx.replyWithPhoto(
        {source: philosopher.avatar},
        {
            caption: resultText,
        }
    );
    ctx.reply(
        'Привет! 🦒\nХочешь узнать статистику?',
        Markup.inlineKeyboard([
            [Markup.button.callback('Да, покажи!', 'show_stats')],
        ])
    );


    // Сохраняем результат в базу
    db.data.results.push({
        user: ctx.from.username || ctx.from.id,
        topPhilosopher: philosopher.name,
        scores: session.scores,
        answers: session.answers,
        date: new Date().toISOString()
    });
    await db.write();
}

bot.action('show_stats', (ctx) => {
    console.log('Пользователь нажал статистику', ctx.from.username);
    ctx.answerCbQuery(); // закрываем "часики" на кнопке

    printAnalytics();

    const winners = getWinnerStats();
    const answers = getAnswerStats();

    let msg = '📊 Статистика по всем прохождениям:\n\n';
    msg += '🏆 Победители:\n';
    for (const [ph, c] of Object.entries(winners)) {
        msg += `${ph}: ${c}\n`;
    }

    msg += '\n✅ Популярность ответов:\n';
    for (const [key, c] of Object.entries(answers)) {
        msg += `${key}: ${c}\n`;
    }

    ctx.reply(msg);
});

// Команда /stats
bot.command('stats', (ctx) => {
    const winners = getWinnerStats();
    const answers = getAnswerStats();

    let msg = '📊 Статистика по всем прохождениям:\n\n';
    msg += '🏆 Победители:\n';
    for (const [ph, c] of Object.entries(winners)) {
        msg += `${ph}: ${c}\n`;
    }

    msg += '\n✅ Популярность ответов:\n';
    for (const [key, c] of Object.entries(answers)) {
        msg += `${key}: ${c}\n`;
    }

    ctx.reply(msg);
});

// Запуск бота
bot.launch();
console.log('✅ Бот запущен. Жми /start в Telegram.');
