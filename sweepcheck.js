// sweepcheck.js — the "Sweep check" skill: one pass over every track you have
// placed, paying out on the ones that landed and charging for the ones that
// did not. Loaded via <script src> before song-year-placer.html's main script
// (classic <script> tags share one top-level scope, same as data.js/BATCHES),
// so the economy below can be retuned without touching the rest of the game.
//
// available()/run() reference placedCount(), placedYears(), confirmed,
// cardById(), slots, flash() and coinWord() — all declared in the main script.
// That's safe because they only run later, in response to a player action.

// ---------------------------------------------------------------------------
//  Economy — every number the sweep pays or charges. Expect to retune these.
// ---------------------------------------------------------------------------
// The first sweep of a decade costs COST_START; every sweep after that costs
// COST_STEP more, and the price resets when the decade does. A flat price made
// the board worth re-sweeping over and over: each pass rules out three years
// per track for one coin, where a spot check rules out one for one, so a player
// with no ear for the music could grind a decade out more cheaply by sweeping
// than by guessing. Charging more for each repeat leaves the opening read cheap
// and makes the grind the expensive way round.
const SWEEP_CHECK_COST_START = 2;
const SWEEP_CHECK_COST_STEP = 1;
const SWEEP_CHECK_EXACT_REWARD = 1;    // per track sitting on its exact year (also locks it)
const SWEEP_CHECK_NEAR_REWARD = 0;     // per track within SWEEP_CHECK_NEAR_YEARS
const SWEEP_CHECK_MISS_PENALTY = 1;    // per track further out than that
const SWEEP_CHECK_NEAR_YEARS = 1;      // how far still counts as "near", in years

let sweepCheckUses = 0;
function resetSweepCheck(){ sweepCheckUses = 0; }
function sweepCheckCost(){ return SWEEP_CHECK_COST_START + sweepCheckUses * SWEEP_CHECK_COST_STEP; }

// The main script's coinWord() would be the natural thing to build the
// description with, but this file is evaluated before it exists — description
// is a plain string, read at load time — so it needs its own local copy.
function sweepCoinWord(n){ return n + ' coin' + (n === 1 ? '' : 's'); }

// A near miss is recorded as the year it was *tested against*, not just "close",
// so the marker stays true after the track is dragged somewhere else — and two
// markers on one track pin its real year between them. Sweeping the same track
// on the same year twice adds nothing new, hence the dedupe.
function sweepCheckMarkNear(card, year){
  if (!card.nearMisses.includes(year)) card.nearMisses.push(year);
}

function sweepCheckMessage(exact, near, miss, reward){
  const parts = [];
  if (exact) parts.push(exact + ' locked');
  if (near) parts.push(near + ' a year out');
  if (miss) parts.push(miss + ' further out');
  const net = reward > 0 ? coinWord(reward) + ' back'
    : reward < 0 ? coinWord(-reward) + ' docked'
    : 'nothing back';
  return parts.join(', ') + ' — ' + net + '.';
}

const SWEEP_CHECK_SKILL = {
  id: 'sweepcheck',
  name: 'Sweep check',
  cost: sweepCheckCost,
  target: 'timeline',
  use: 'the timeline',
  requirement: 'a song on the timeline',
  short: 'Tests every placed track at once.',
  // Printed on the card in the shared effects grammar — see SKILLS in
  // song-year-placer.html for the shape. `each` because a sweep pays and
  // charges per track, not per use.
  // "per track" is the caption over the coin column: a sweep pays and charges
  // once for every track it touches, and saying so once beats "ea" on each row.
  perUnit: 'per track',
  effects: [
    { when: 'spot on',    result: 'LOCK', coins: SWEEP_CHECK_EXACT_REWARD,
      hint: 'On its exact year: the track locks for the decade and pays out.' },
    { when: '1 year out', result: 'BADGE', coins: 0,
      hint: 'Leaves a badge on the track naming the year it was tested against, '
        + 'so its real year is one either side of that. Costs nothing, pays nothing.' },
    { when: 'further out', result: 'MISS', coins: -SWEEP_CHECK_MISS_PENALTY,
      hint: 'More than a year out. You learn nothing about it and it costs you.' },
  ],
  description: 'Tests every track you have placed, all at once. Each one sitting on its exact year locks and pays '
    + sweepCoinWord(SWEEP_CHECK_EXACT_REWARD) + ' back; each one a single year out is badged with the year it was tested '
    + 'against and pays nothing; everything further out costs you ' + sweepCoinWord(SWEEP_CHECK_MISS_PENALTY)
    + '. Price climbs ' + SWEEP_CHECK_COST_STEP + ' coin each sweep, and resets when the decade clears.',
  available: () => placedCount() > 0,
  run(){
    let exact = 0, near = 0, miss = 0;
    const lockedYears = [];

    placedYears().forEach(y => {
      const cardId = slots['year' + y];
      // A locked track is settled and pays nothing a second time — without
      // this, re-sweeping a board of locked tracks would mint coins forever.
      if (confirmed.has(cardId)) return;

      const card = cardById(cardId);
      const off = Math.abs(card.song.year - y);
      if (off === 0){
        confirmed.add(cardId);
        lockedYears.push(y);
        exact++;
      } else if (off <= SWEEP_CHECK_NEAR_YEARS){
        sweepCheckMarkNear(card, y);
        near++;
      } else {
        miss++;
      }
    });

    // Nothing loose on the board — charging for a sweep that cannot report
    // anything would just be a tax, so it is turned away free of charge.
    if (!exact && !near && !miss){
      return { ok: false, message: 'Every placed track is already locked — nothing left to sweep.' };
    }

    // Only a sweep that actually ran counts towards the price of the next one.
    // useSkill() reads the cost before calling run(), so this bumps the price
    // for the following sweep rather than the one being paid for now.
    sweepCheckUses++;

    const reward = exact * SWEEP_CHECK_EXACT_REWARD
      + near * SWEEP_CHECK_NEAR_REWARD
      - miss * SWEEP_CHECK_MISS_PENALTY;

    if (lockedYears.length) flash(lockedYears, 'SPOT ON', 'good');
    return { ok: true, reward, message: sweepCheckMessage(exact, near, miss, reward) };
  }
};
