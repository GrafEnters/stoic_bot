import {Low} from 'lowdb';
import {JSONFile} from 'lowdb/node';
import {existsSync, writeFileSync, readFileSync} from 'node:fs';

if (!existsSync('./data/greetings.json')) {
    writeFileSync('./data/greetings.json', JSON.stringify({greetings: []}, null, 2));
}

if (!existsSync('/data/users.json')) {
    writeFileSync('/data/users.json', JSON.stringify({users: []}, null, 2));
}

const usersAdapter = new JSONFile('/data/users.json');
const usersDb = new Low(usersAdapter, {users: []});

await usersDb.read();
usersDb.data ||= {users: []};

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

export async function addUser(chatId) {
    await usersDb.read();
    if (!usersDb.data.users.includes(chatId)) {
        usersDb.data.users.push(chatId);
        await usersDb.write();
    }
}

