// gutcheck.js — the "Gut Check" skill: one pass over every track you have
// placed, paying out on the ones that landed and charging for the ones that
// did not. Loaded via <script src> before song-year-placer.html's main script
// (classic <script> tags share one top-level scope, same as data.js/BATCHES),
// so the economy below can be retuned without touching the rest of the game.
//
// available()/run() reference placedCount(), placedYears(), confirmed,
// cardById(), slots, flash() and coinWord() — all declared in the main script.
// That's safe because they only run later, in response to a player action.

// ---------------------------------------------------------------------------
//  Economy — every number the check pays or charges. Expect to retune these.
// ---------------------------------------------------------------------------
// COST_START for the first check of a decade, +COST_STEP each after, reset
// per decade — escalation is what keeps grinding checks from beating guessing
// (see design.md).
const GUT_CHECK_COST_START = 2;
const GUT_CHECK_COST_STEP = 1;
const GUT_CHECK_EXACT_REWARD = 1;    // per track sitting on its exact year (also locks it)
const GUT_CHECK_NEAR_REWARD = 0;     // per track within GUT_CHECK_NEAR_YEARS
const GUT_CHECK_MISS_PENALTY = 1;    // per track further out than that
const GUT_CHECK_NEAR_YEARS = 1;      // how far still counts as "near", in years

let gutCheckUses = 0;
function resetGutCheck(){ gutCheckUses = 0; }
function gutCheckCost(){ return GUT_CHECK_COST_START + gutCheckUses * GUT_CHECK_COST_STEP; }

// A near miss is recorded as the year it was *tested against*, not just "close",
// so the marker stays true after the track is dragged somewhere else — and two
// markers on one track pin its real year between them. Checking the same track
// on the same year twice adds nothing new, hence the dedupe.
function gutCheckMarkNear(card, year){
  if (!card.nearMisses.includes(year)) card.nearMisses.push(year);
}

function gutCheckMessage(exact, near, miss, reward){
  const parts = [];
  if (exact) parts.push(exact + ' locked');
  if (near) parts.push(near + ' a year out');
  if (miss) parts.push(miss + ' further out');
  const net = reward > 0 ? coinWord(reward) + ' back'
    : reward < 0 ? coinWord(-reward) + ' docked'
    : 'nothing back';
  return parts.join(', ') + ' — ' + net + '.';
}

const GUT_CHECK_SKILL = {
  id: 'gutcheck',
  name: 'Gut Check',
  cost: gutCheckCost,
  target: 'timeline',
  use: 'the timeline',
  requirement: 'a song on the timeline',
  // {badge:near-miss} is swapped for a chip in that badge's own amber by the
  // renderer (withBadgeChips in song-year-placer.html).
  short: 'Tests every placed track at once — a near miss leaves a {badge:near-miss}.',
  // The caption over the coin column — a check pays and charges per track,
  // not per use. See SKILLS in song-year-placer.html for the effects shape.
  perUnit: 'per track',
  effects: [
    { when: 'spot on',    result: 'LOCK', coins: GUT_CHECK_EXACT_REWARD,
      hint: 'On its exact year: the track locks for the decade and pays out.' },
    // Plain 0 rather than the INFO mark the other badge-leaving skills show:
    // this card is read as a column of per-track arithmetic, and the badge it
    // leaves is already promised in the blurb above. See `short`.
    { when: '1 year out', result: 'NEAR', coins: 0,
      hint: 'Leaves a badge on the track naming the year it was tested against, '
        + 'so its real year is one either side of that. Costs nothing, pays nothing.' },
    { when: 'further out', result: 'MISS', coins: -GUT_CHECK_MISS_PENALTY,
      hint: 'More than a year out. You learn nothing about it and it costs you.' },
  ],
  available: () => placedCount() > 0,
  run(){
    let exact = 0, near = 0, miss = 0;
    const lockedYears = [];

    placedYears().forEach(y => {
      const cardId = slots['year' + y];
      // A locked track is settled and pays nothing a second time — without
      // this, re-checking a board of locked tracks would mint coins forever.
      if (confirmed.has(cardId)) return;

      const card = cardById(cardId);
      const off = Math.abs(card.song.year - y);
      if (off === 0){
        confirmed.add(cardId);
        lockedYears.push(y);
        exact++;
      } else if (off <= GUT_CHECK_NEAR_YEARS){
        gutCheckMarkNear(card, y);
        near++;
      } else {
        miss++;
      }
    });

    // Nothing loose on the board — charging for a check that cannot report
    // anything would just be a tax, so it is turned away free of charge.
    if (!exact && !near && !miss){
      return { ok: false, message: 'Every placed track is already locked — nothing left to check.' };
    }

    // Only a check that actually ran counts towards the price of the next one.
    // useSkill() reads the cost before calling run(), so this bumps the price
    // for the following check rather than the one being paid for now.
    gutCheckUses++;

    const reward = exact * GUT_CHECK_EXACT_REWARD
      + near * GUT_CHECK_NEAR_REWARD
      - miss * GUT_CHECK_MISS_PENALTY;

    if (lockedYears.length) flash(lockedYears, 'SPOT ON', 'good');
    return { ok: true, reward, message: gutCheckMessage(exact, near, miss, reward) };
  }
};
