import {existsSync, writeFileSync, readFileSync} from 'node:fs';

if (!existsSync('./data/greetings.json')) {
    writeFileSync('./data/greetings.json', JSON.stringify({greetings: []}, null, 2));
}

export function getRandomGreeting() {
    const greetingsData = JSON.parse(readFileSync('./data/greetings.json', 'utf8'));
    const greetings = greetingsData.greetings || [];
    
    if (greetings.length === 0) {
        return null;
    }
    
    const randomIndex = Math.floor(Math.random() * greetings.length);
    return greetings[randomIndex];
}

export function isNewYearPeriod() {
    const now = new Date();
    const month = now.getMonth();
    const date = now.getDate();
    
    return month === 0 && date >= 1 && date <= 7;
}

