import { bootstrap } from '../../src/bootstrap.js';
import { currentGame } from '../../src/catalog.js';
import { createCloudFixture } from './cloud.js';
const game = currentGame(),
  params = new URLSearchParams(location.search);
await Promise.all(
  game.assets.styles.map((style) => import(/* @vite-ignore */ '/mind-arcade/' + style)),
);
const fixture = createCloudFixture();
const service = bootstrap({
  cloud: {
    client: fixture.client,
    config: { url: 'https://example.test', publishableKey: 'public-test-key' },
  },
});
window.fixture = { ...fixture, service };
if (params.get('fixture') === 'visual') {
  const { mountVisualSpan } = await import('../../src/engines/visual-span/app.js');
  const bank = Array.from({ length: 24 }, (_, i) => ({
    id: `item-${i}`,
    category: `group-${Math.floor(i / 2)}`,
    label: String(i + 1),
    drawing: `<text x="35" y="60">${i + 1}</text>`,
  }));
  mountVisualSpan({
    bank,
    startLength: Number(params.get('length') || 1),
    members: 2,
    random: () => 0.6,
  });
} else {
  if (params.get('fixture') === 'progressive') {
    const { CognitiveGame } = await import('../../src/engines/progressive.js');
    const init = CognitiveGame.init;
    CognitiveGame.init = (config) => {
      window.fixture.task = config;
      init({
        ...config,
        run(ctx, plan) {
          window.fixture.context = ctx;
          return config.run(ctx, plan);
        },
      });
    };
  }
  const { mountGame } = await import(/* @vite-ignore */ '/mind-arcade/' + game.assets.entry);
  mountGame();
}

window.fixture.ready = true;

document.documentElement.dataset.fixtureReady = 'true';
