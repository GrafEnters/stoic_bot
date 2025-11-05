import {Low} from 'lowdb';
import {JSONFile} from 'lowdb/node';

const adapter = new JSONFile('./data/results.json');
const db = new Low(adapter, {results: []});

await db.read();
db.data ||= {results: []};

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
    const count = {};
    for (const r of db.data.results) {
        if (!r.answers) continue;
        for (const ans of r.answers) {
            const key = `${ans.questionId}_${ans.value}`;
            if (!count[key]) count[key] = 0;
            count[key]++;
        }
    }
    return count;
}
