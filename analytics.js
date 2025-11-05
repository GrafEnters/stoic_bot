import {Low} from 'lowdb';
import {JSONFile} from 'lowdb/node';
import {readFileSync} from 'node:fs';

const adapter = new JSONFile('./data/results.json');
const db = new Low(adapter, {results: []});

await db.read();
db.data ||= {results: []};

const questions = JSON.parse(readFileSync('./data/questions.json', 'utf8'));

export function getWinnerStats() {
    const count = {};
    for (const r of db.data.results) {
        const top = r.topPhilosopher;
        if (!count[top]) count[top] = 0;
        count[top]++;
    }
    return count;
}

export function getAnswerStats() {
    const stats = {};

    for (const r of db.data.results) {
        if (!r.answers) continue;
        for (const ans of r.answers) {
            const qid = ans.questionId;
            const val = ans.value;

            if (!stats[qid]) {
                stats[qid] = {};
            }

            if (!stats[qid][val]) {
                stats[qid][val] = 0;
            }

            stats[qid][val]++;
        }
    }

    const formatted = {};

    for (const [qid, answers] of Object.entries(stats)) {
        const total = Object.values(answers).reduce((a, b) => a + b, 0);
        const parts = Object.entries(answers)
            .map(([val, count]) => {
                const percent = Math.round((count / total) * 100);
                return `${val} ${percent}%`;
            })
            .join(' ');
        formatted[qid] = parts;
    }

    return formatted;
}

export function getRandomCustomAnswers(count = 3) {
    const customAnswers = [];
    
    for (const r of db.data.results) {
        if (!r.answers) continue;
        for (const ans of r.answers) {
            if (ans.customText) {
                const question = questions.find(q => q.id === ans.questionId);
                if (question) {
                    customAnswers.push({
                        question: question.question,
                        answer: ans.customText
                    });
                }
            }
        }
    }
    
    if (customAnswers.length === 0) return [];
    
    const shuffled = customAnswers.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, customAnswers.length));
}
