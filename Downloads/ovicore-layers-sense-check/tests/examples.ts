import { senseCheckLayerEntry } from '../src/layersSenseCheck';

const tests: Array<[string, boolean]> = [
  ['extra digit feed', senseCheckLayerEntry('feed_g_per_bird_day', 1150, [115, 116, 114, 117, 115]).status === 'warning'],
  ['normal feed', senseCheckLayerEntry('feed_g_per_bird_day', 118, [115, 116, 114, 117, 115]).status === 'ok'],
  ['zero-heavy mortality', senseCheckLayerEntry('mortality_birds', 1, [0, 0, 0, 1, 0]).status === 'ok'],
  ['mortality spike', senseCheckLayerEntry('mortality_birds', 32, [1, 2, 1, 0, 1]).status === 'warning'],
  ['not enough history', senseCheckLayerEntry('egg_weight_g', 64, [63, 64]).status === 'insufficient_history'],
];
for (const [name, passed] of tests) {
  if (!passed) throw new Error(`Failed: ${name}`);
  console.log(`PASS ${name}`);
}
