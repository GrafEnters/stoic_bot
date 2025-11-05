import {Telegraf, Markup} from 'telegraf';
import {Low} from 'lowdb';
import {JSONFile} from 'lowdb/node';
import dotenv from 'dotenv';
import {getWinnerStats, getAnswerStats, printAnalytics} from './analytics.js';
import {questions, sendQuestion, showResult, startQuiz} from "./quiz.js";
import {existsSync, writeFileSync} from "node:fs";

dotenv.config();

// База для результатов

// создаём файл, если его нет
if (!existsSync('./data/results.json')) {
    writeFileSync('./data/results.json', JSON.stringify({results: []}, null, 2));
}

const adapter = new JSONFile('./data/results.json');
const db = new Low(adapter, {results: []});

await db.read();
db.data ||= {results: []}; // теперь безопасно

// Загружаем вопросы и философов


const bot = new Telegraf(process.env.BOT_TOKEN);
export const sessions = new Map();

// Старт
bot.start((ctx) => {
    ctx.reply('Привет! 🦒\nХочешь узнать, какой ты философ?', Markup.inlineKeyboard([[Markup.button.callback('Да, поехали!', 'start_quiz')], [Markup.button.callback('Я уже философ.', 'already')], [Markup.button.callback('Покажи статистику!', 'show_stats')]]));
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


bot.action('show_stats', (ctx) => {
    ctx.answerCbQuery();

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

// Обработка ответов
bot.on('callback_query', async (ctx) => {
    console.log('callback_query');
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
        var dbRecord = await showResult(ctx);
        // Сохраняем результат в базу
        db.data.results.push(dbRecord);
        await db.write();

        sessions.delete(ctx.chat.id);
    }
});


// Команда /stats
bot.command('stats', (ctx) => {
    console.log('Пользователь вызвал stats', ctx.from.username);
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
await bot.launch();
console.log('✅ Бот запущен. Жми /start в Telegram.');
