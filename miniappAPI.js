import express from 'express';
import {Low} from 'lowdb';
import {JSONFile} from 'lowdb/node';
import {existsSync, writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

let server = null;

export function startMiniappAPI() {
    if (server) {
        return;
    }

    if (!existsSync('./data/players.json')) {
        writeFileSync('./data/players.json', JSON.stringify({players: {}}, null, 2));
    }

    const adapter = new JSONFile('./data/players.json');
    const db = new Low(adapter, {players: {}});

    (async () => {
        await db.read();
        db.data ||= {players: {}};
    })();

    const app = express();
    const PORT = process.env.MINIAPP_PORT || 3001;

    app.use(express.json());

    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }
        next();
    });

    const router = express.Router();

    router.post('/player', async (req, res) => {
        try {
            const playerData = req.body;
            const playerId = randomUUID();

            await db.read();
            db.data ||= {players: {}};

            db.data.players[playerId] = {
                ...playerData,
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };

            await db.write();

            res.json({ _id: playerId });
        } catch (error) {
            console.error('Ошибка при создании игрока:', error);
            res.status(500).json({ error: 'Ошибка при создании игрока' });
        }
    });

    router.put('/player/:playerId', async (req, res) => {
        try {
            const playerId = req.params.playerId;
            const playerData = req.body;

            await db.read();
            db.data ||= {players: {}};

            db.data.players[playerId] = {
                ...playerData,
                lastUpdated: new Date().toISOString()
            };

            await db.write();

            res.json({ success: true, message: 'Player data saved' });
        } catch (error) {
            console.error('Ошибка при сохранении данных игрока:', error);
            res.status(500).json({ error: 'Ошибка при сохранении данных игрока' });
        }
    });

    router.get('/player/:playerId', async (req, res) => {
        try {
            const playerId = req.params.playerId;

            await db.read();
            db.data ||= {players: {}};

            const playerData = db.data.players[playerId];

            if (!playerData) {
                return res.status(404).json({ error: 'Player not found' });
            }

            res.json(playerData);
        } catch (error) {
            console.error('Ошибка при получении данных игрока:', error);
            res.status(500).json({ error: 'Ошибка при получении данных игрока' });
        }
    });

    router.get('/health', (req, res) => {
        res.status(200).json({ status: 'ok', service: 'miniapp-api' });
    });

    app.use('/miniapp', router);

    server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`📱 MiniApp API server listening on port ${PORT}`);
    });

    server.on('error', (err) => {
        console.error('Ошибка MiniApp API сервера:', err);
    });
}
