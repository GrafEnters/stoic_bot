import {Low} from 'lowdb';
import {JSONFile} from 'lowdb/node';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';

export async function migratePlayersIfNeeded() {
    const wrongFormatPath = './data/players_wrong_format.json';
    const correctFormatPath = '/data/players.json';
    
    if (!existsSync(wrongFormatPath)) {
        return;
    }
    
    console.log('Найден файл players_wrong_format.json, начинаю миграцию...');
    
    try {
        const wrongFormatData = JSON.parse(readFileSync(wrongFormatPath, 'utf8'));
        const playersArray = wrongFormatData.players || [];
        
        if (!Array.isArray(playersArray) || playersArray.length === 0) {
            console.log('Файл players_wrong_format.json пуст или имеет неправильную структуру');
            return;
        }
        
        if (!existsSync(correctFormatPath)) {
            writeFileSync(correctFormatPath, JSON.stringify({players: {}}, null, 2));
        }
        
        const adapter = new JSONFile(correctFormatPath);
        const db = new Low(adapter, {players: {}});
        
        await db.read();
        db.data ||= {players: {}};
        
        let migratedCount = 0;
        let skippedCount = 0;
        
        for (const player of playersArray) {
            const playerId = randomUUID();
            
            const playerData = {
                ...player,
                lastUpdated: player.SavedDate || new Date().toISOString()
            };
            
            if (playerData.TreePartData && !playerData.TreePartData.PlayerId) {
                playerData.TreePartData.PlayerId = playerId;
            }
            
            db.data.players[playerId] = playerData;
            migratedCount++;
        }
        
        await db.write();
        
        console.log(`Миграция завершена: добавлено ${migratedCount} игроков, пропущено ${skippedCount}`);
        console.log(`Файл players_wrong_format.json можно удалить вручную после проверки`);
        
    } catch (error) {
        console.error('Ошибка при миграции players_wrong_format.json:', error);
    }
}

