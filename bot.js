import {Telegraf, Markup} from 'telegraf';
import {Low} from 'lowdb';
import {JSONFile} from 'lowdb/node';
import dotenv from 'dotenv';
import {getWinnerStats, getAnswerStats, getRandomCustomAnswers} from './analytics.js';
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
    ctx.replyWithPhoto({source: 'data/avatars/Hello.jpg'}, {
        caption: 'Привет! 🦒\nХочешь узнать, какой ты философ?',
        reply_markup: Markup.inlineKeyboard(
            [[Markup.button.callback('Да, поехали!', 'start_quiz')],
                [Markup.button.callback('Я уже философ.', 'already')],
                [Markup.button.callback('Покажи статистику!', 'show_stats')]]).reply_markup
    });
});

bot.action('already', async (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('Тем интереснее — сверим показания!');
    await startQuiz(ctx);
});

bot.action('start_quiz', async (ctx) => {
    ctx.answerCbQuery();
    await startQuiz(ctx);
});


bot.action('show_stats', (ctx) => {
    ctx.answerCbQuery();

    const winners = getWinnerStats();
    const answers = getAnswerStats();
    const customAnswers = getRandomCustomAnswers(3);

    let msg = '📊 Статистика по всем прохождениям:\n\n';
    msg += '🏆 Победители:\n';
    for (const [ph, c] of Object.entries(winners)) {
        msg += `${ph}: ${c}\n`;
    }

    msg += '\n✅ Популярность ответов:\n';
    for (const [key, c] of Object.entries(answers)) {
        msg += `${key}: ${c}\n`;
    }

    if (customAnswers.length > 0) {
        msg += '\n3 случайных необычных ответа:\n';
        for (const item of customAnswers) {
            msg += `- ${item.question}: ${item.answer}\n`;
        }
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

    const choice = q.options.find(o => o.value === answer);

    if (choice && choice.text.includes('Свой вариант')) {
        session.waitingCustomAnswer = true;
        session.currentQuestionId = q.id;
        session.currentAnswerValue = answer;
        session.currentQuestionMessageId = ctx.callbackQuery.message.message_id;
        if (choice.philosophers) {
            session.currentAnswerPhilosophers = choice.philosophers;
        }
        ctx.answerCbQuery();
        ctx.reply('Напиши свой вариант ответа сообщением:');
        return;
    }

    session.answers.push({questionId: q.id, value: answer});

    if (choice) {
        for (const ph of choice.philosophers) {
            session.scores[ph] = (session.scores[ph] || 0) + 1;
        }
    }

    session.index++;
    ctx.answerCbQuery();

    setTimeout(async () => {
        try {
            await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
        } catch (e) {
            console.log('Не удалось удалить сообщение:', e);
        }
    }, 1500);

    if (session.index < questions.length) {
        await sendQuestion(ctx);
    } else {
        var dbRecord = await showResult(ctx);
        // Сохраняем результат в базу
        db.data.results.push(dbRecord);
        await db.write();

        sessions.delete(ctx.chat.id);
    }
});


// Обработка текстовых ответов (для "Свой вариант")
bot.on('text', async (ctx) => {
    const session = sessions.get(ctx.chat.id);
    if (!session || !session.waitingCustomAnswer) return;

    const customText = ctx.message.text;
    session.answers.push({
        questionId: session.currentQuestionId,
        value: session.currentAnswerValue,
        customText: customText
    });

    if (session.currentAnswerPhilosophers) {
        for (const ph of session.currentAnswerPhilosophers) {
            session.scores[ph] = (session.scores[ph] || 0) + 1;
        }
    }

    session.waitingCustomAnswer = false;

    if (session.currentQuestionMessageId) {
        setTimeout(async () => {
            try {
                await ctx.deleteMessage(session.currentQuestionMessageId);
            } catch (e) {
                console.log('Не удалось удалить сообщение:', e);
            }
        }, 1500);
    }
    delete session.currentQuestionId;
    delete session.currentAnswerValue;
    delete session.currentAnswerPhilosophers;
    delete session.currentQuestionMessageId;

    session.index++;

    if (session.index < questions.length) {
        await sendQuestion(ctx);
    } else {
        var dbRecord = await showResult(ctx);
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
    const customAnswers = getRandomCustomAnswers(3);

    let msg = '📊 Статистика по всем прохождениям:\n\n';
    msg += '🏆 Победители:\n';
    for (const [ph, c] of Object.entries(winners)) {
        msg += `${ph}: ${c}\n`;
    }

    msg += '\n✅ Популярность ответов:\n';
    for (const [key, c] of Object.entries(answers)) {
        msg += `${key}: ${c}\n`;
    }

    if (customAnswers.length > 0) {
        msg += '\n3 случайных необычных ответа:\n';
        for (const item of customAnswers) {
            msg += `- ${item.question}: ${item.answer}\n`;
        }
    }

    ctx.reply(msg);
});

// Запуск бота
await bot.launch();
console.log('✅ Бот запущен. Жми /start в Telegram.');
