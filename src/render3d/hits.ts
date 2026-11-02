// Click boxes (width, height in scene units) per target kind; anything unlisted uses DEFAULT_HIT. Small ground items
// get boxes no bigger than their placeholder, so a nearer one cannot cover a bug or shell standing just behind it.
export const HIT: Record<string, [number, number]> = {stone: [1.4, 1], animal: [1.1, 1], monster: [1.3, 1.2], friend: [1, 1.7], camp: [2.4, 2], workbench: [1.4, 1.1], board: [1.3, 1.4], bag: [1.1, .9], rain: [1.1, 1.2], museum: [1.4, 1.8], shop: [1.4, 1.8], cave: [2, 1.6], bug: [.7, .9], shell: [.7, .6], dive: [.9, .8], jungle: [1, 1.5], fiber: [.7, .7], coconut: [.7, .7], wood: [.8, .6], dig: [.9, .5], buried: [.8, .5], worm: [.8, .5], shrimp: [.7, .7], plot: [1, .5], message: [.6, .7], fishing: [.9, .8], 'reef-fishing': [.9, .8]};
export const DEFAULT_HIT: [number, number] = [1, 1.1], STUMP_HIT: [number, number] = [1, .7];
// Standing trees (choppable ones and fruit trees) are picked by trunk and crown, see treeBox().
export const TREE_KINDS = new Set(['tree', 'fruit']);
export const hitSize = (kind: string, cut: boolean): [number, number] => cut ? STUMP_HIT : HIT[kind] ?? DEFAULT_HIT;
