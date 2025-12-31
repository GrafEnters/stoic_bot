import './bot.js';
import {startMiniappAPI} from './miniappAPI.js';
import {migratePlayersIfNeeded} from './migratePlayers.js';

(async () => {
    await migratePlayersIfNeeded();
    startMiniappAPI();
})();

