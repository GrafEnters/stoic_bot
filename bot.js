import {Telegraf, Markup} from 'telegraf';
import {Low} from 'lowdb';
import {JSONFile} from 'lowdb/node';
import dotenv from 'dotenv';
import {getWinnerStats, getAnswerStats, getRandomCustomAnswers} from './analytics.js';
import {questions, sendQuestion, showResult, startQuiz} from "./quiz.js";
import {existsSync, writeFileSync} from "node:fs";
import {getRandomGreeting, isNewYearPeriod} from './greetings.js';

dotenv.config();

// База для результатов

// создаём файл, если его нет
if (!existsSync('/data/results.json')) {
    writeFileSync('/data/results.json', JSON.stringify({results: []}, null, 2));
}

const adapter = new JSONFile('/data/results.json');
const db = new Low(adapter, {results: []});

await db.read();
db.data ||= {results: []}; // теперь безопасно

// Загружаем вопросы и философов


const bot = new Telegraf(process.env.BOT_TOKEN);
export {bot};
export const sessions = new Map();

// Старт
bot.start(async (ctx) => {
    console.log('✅ Бот start.');
    
    if (isNewYearPeriod()) {
        const greeting = getRandomGreeting();
        if (greeting) {
            try {
                await ctx.reply(greeting);
            } catch (error) {
                console.error('Ошибка при отправке поздравления:', error.message);
            }
        }
    }
    
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

bot.catch((err, ctx) => {
    console.error('Ошибка в обработчике:', err);
    try {
        ctx.reply('Произошла ошибка. Попробуйте позже.');
    } catch (e) {
        console.error('Не удалось отправить сообщение об ошибке:', e);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    if (reason?.response?.error_code === 409) {
        console.log('⚠️ Конфликт polling (409) - игнорирую, переподключение уже обработано');
        return;
    }
    console.error('Необработанное отклонение промиса:', reason);
});

process.on('uncaughtException', (error) => {
    if (error.response?.error_code === 409) {
        console.log('⚠️ Конфликт polling (409) - ожидание переподключения...');
        return;
    }
    console.error('Необработанное исключение:', error);
});

process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

async function gracefulShutdown(signal) {
    console.log(`Получен сигнал ${signal}, останавливаю бота...`);
    isRunning = false;
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
    try {
        if (bot.telegram.webhookReply) {
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        }
        await bot.stop(signal);
        console.log('✅ Бот остановлен');
        process.exit(0);
    } catch (err) {
        console.error('Ошибка при остановке бота:', err);
        process.exit(1);
    }
}

let isRunning = false;
let reconnectTimeout = null;
let healthCheckInterval = null;

async function startBot() {
    if (isRunning) {
        console.log('Бот уже запущен, пропускаю повторный запуск');
        return;
    }

    try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        await bot.launch();
        isRunning = true;
        console.log('✅ Бот запущен. Жми /start в Telegram.');
        
        if (!healthCheckInterval) {
            startHealthCheck();
        }
    } catch (err) {
        isRunning = false;
        
        if (err.response?.error_code === 409) {
            console.log('⚠️ Конфликт: другой экземпляр бота запущен. Ожидание 15 секунд...');
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            reconnectTimeout = setTimeout(() => {
                reconnectTimeout = null;
                startBot();
            }, 15000);
        } else {
            console.error('Ошибка при запуске бота:', err);
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            reconnectTimeout = setTimeout(() => {
                reconnectTimeout = null;
                startBot();
            }, 5000);
        }
    }
}

function startHealthCheck() {
    if (healthCheckInterval) {
        return;
    }
    
    healthCheckInterval = setInterval(async () => {
        try {
            await bot.telegram.getMe();
        } catch (err) {
            if (err.response?.error_code === 409) {
                console.log('⚠️ Конфликт polling обнаружен, переподключение...');
            } else {
                console.error('Ошибка проверки соединения:', err);
            }
            
            if (isRunning) {
                console.log('Переподключение...');
                isRunning = false;
                try {
                    await bot.stop();
                } catch (e) {
                    if (e.response?.error_code !== 409) {
                        console.error('Ошибка при остановке:', e);
                    }
                }
                if (reconnectTimeout) clearTimeout(reconnectTimeout);
                const delay = err.response?.error_code === 409 ? 15000 : 5000;
                reconnectTimeout = setTimeout(() => {
                    reconnectTimeout = null;
                    startBot();
                }, delay);
            }
        }
    }, 60000);
}

startBot();
