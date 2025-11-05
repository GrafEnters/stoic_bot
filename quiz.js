import {Markup} from "telegraf";
import {readFileSync} from "node:fs";
import {sessions} from "./bot.js";

export const questions = JSON.parse(readFileSync('./data/questions.json', 'utf8'));
export const philosophers = JSON.parse(readFileSync('./data/philosophers.json', 'utf8'));


// Запуск квиза
export async function startQuiz(ctx) {
    const scores = {};
    for (const p of philosophers) scores[p.id] = 0;

    sessions.set(ctx.chat.id, {
        index: 0, scores, answers: []
    });

    await sendQuestion(ctx);
}


// Отправка вопроса
export async function sendQuestion(ctx) {
    const session = sessions.get(ctx.chat.id);
    const q = questions[session.index];

    const message = await ctx.reply(`Вопрос ${session.index + 1}/${questions.length}\n${q.question}`, Markup.inlineKeyboard(q.options.map(opt => [Markup.button.callback(opt.text, opt.value)])));
    session.lastQuestionMessageId = message.message_id;
}

export async function showResult(ctx) {
    ctx.reply('Готово!\nСекундочку... сверяю твои ответы с древними свитками 🤓');

    const session = sessions.get(ctx.chat.id);
    if (session.scores["Диоген_plus"] > 0) {
        session.scores["Диоген"] += session.scores["Диоген_plus"] * 1.5;
        session.scores["Диоген_plus"] = 0;
    }
    
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

    await ctx.replyWithPhoto({source: philosopher.avatar}, {
        caption: resultText,
    });
    await ctx.reply('Привет! 🦒\nХочешь узнать статистику?', Markup.inlineKeyboard([Markup.button.callback('Да, покажи!', 'show_stats')]));

    return {
        user: ctx.from.username || ctx.from.id,
        topPhilosopher: philosopher.name,
        scores: session.scores,
        answers: session.answers,
        date: new Date().toISOString()
    }
}