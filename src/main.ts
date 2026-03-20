import { Game } from './game/Game';

const container = document.getElementById('game-container');
if (!container) throw new Error('#game-container not found');

const game = new Game();
game.init(container).catch(console.error);
