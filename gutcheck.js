// gutcheck.js — everything about the "Gut Check" skill lives here: its cost,
// the vague dialect it answers in, and the skill card itself. Loaded via
// <script src> before song-year-placer.html's main script (classic <script>
// tags share one top-level scope, same as data.js/BATCHES), so this file can
// be edited on its own without hunting through the rest of the game.
//
// available()/run() below reference placedCount(), NUM_CARDS, confirmed,
// placedYears(), cardById() and slots — all declared in the main script.
// That's safe because those two functions only run later, in response to a
// player action, by which point everything has loaded.

const GUT_CHECK_COST = 2;

// ---------------------------------------------------------------------------
//  The dialect
// ---------------------------------------------------------------------------
// Gut Check never names a track or a year. It sorts every placement into a
// distance band and reports how many landed in each, in deliberately woolly
// words. The mapping is FIXED — the same board always produces the same
// sentences, with no random phrasing — because the whole point is that a
// player who uses the card across a few runs can learn the dialect. "Some"
// has to always mean three or four, or there is nothing to learn.

// Distance bands, nearest first. `max` is inclusive, counted in years away
// from the track's real year, and the last band must stay open-ended so every
// placement lands somewhere. Retune these and you are changing what the card
// is willing to call close — note that the bands cover the whole range with no
// gaps, which is what stops a mediocre board from reading as a good one.
const GUT_CHECK_BANDS = [
  { max: 0,        label: 'spot on' },
  { max: 1,        label: 'a year out' },
  { max: 4,        label: 'a few years out' },
  { max: Infinity, label: 'way off' },
];

// Absolute counts, never proportions — "some" means 3–4 whether the decade
// holds seven tracks or ten. Proportions would make the same word mean
// different things in different batches, and the dialect would be unlearnable.
const GUT_CHECK_AMOUNTS = [
  { max: 1,        word: 'one',      plural: false },
  { max: 2,        word: 'a couple', plural: true  },
  { max: 4,        word: 'some',     plural: true  },
  { max: 6,        word: 'a bunch',  plural: true  },
  { max: Infinity, word: 'loads',    plural: true  },
];

// The opening line — one gut reaction to the board as a whole. Keyed on the
// mean distance rather than any single band, so it can never cheerfully
// disagree with the breakdown printed underneath it.
const GUT_CHECK_VERDICTS = [
  { max: 0,        line: 'Yeah. That’s the lot.' },
  { max: 0.5,      line: 'This feels right.' },
  { max: 1,        line: 'Pretty good, I reckon.' },
  { max: 2,        line: 'Not bad. Not finished.' },
  { max: 3,        line: 'Alright, I guess.' },
  { max: 4.5,      line: 'Hmm. Shaky, this.' },
  { max: 6,        line: 'No. Something’s wrong here.' },
  { max: Infinity, line: 'This is a mess.' },
];

let gutCheckUsed = false;
// The reply from the last use, as an array of lines, kept on the card itself
// until the decade clears — see the skill's note() below.
let gutCheckReplyLines = null;
function resetGutCheck(){ gutCheckUsed = false; gutCheckReplyLines = null; }

function gutCheckBandOf(distance){
  return GUT_CHECK_BANDS.find(band => distance <= band.max);
}

function gutCheckAmount(count, total){
  // Worth its own phrase: "all of them are way off" is a very different read
  // from "loads are", and it is the one the player most needs to hear.
  if (count === total && total > 1) return { word: 'all of them', plural: true };
  return GUT_CHECK_AMOUNTS.find(amount => count <= amount.max);
}

function gutCheckVerdict(meanDistance){
  return GUT_CHECK_VERDICTS.find(verdict => meanDistance <= verdict.max).line;
}

// Returns the whole reply as lines: the verdict, then one line per band that
// actually caught something, worst first — a gut reaction leads with the bad
// news, and that is the half the player is going to act on.
function gutCheckLines(distances){
  const total = distances.length;
  const mean = distances.reduce((sum, d) => sum + d, 0) / total;
  const lines = [gutCheckVerdict(mean)];

  GUT_CHECK_BANDS.slice().reverse().forEach(band => {
    const count = distances.filter(d => gutCheckBandOf(d) === band).length;
    if (!count) return;
    const amount = gutCheckAmount(count, total);
    const line = amount.word + (amount.plural ? ' are ' : ' is ') + band.label;
    lines.push(line.charAt(0).toUpperCase() + line.slice(1) + '.');
  });

  return lines;
}

const GUT_CHECK_SKILL = {
  id: 'gutcheck',
  name: 'Gut Check',
  cost: GUT_CHECK_COST,
  enabled: false,   // parked while Sweep check is being tried — logic kept intact
  target: 'timeline',
  use: 'the timeline',
  requirement: 'every song placed, nothing locked, unused this decade',
  short: 'A vague read on the whole board.',
  description: 'One vague read on the whole board — no years, no names, no idea which track is which. It answers in the same woolly words every time, so the more you use it the better you understand it. Only works before anything is locked in, once per decade.',
  available: () => !gutCheckUsed && placedCount() === NUM_CARDS && confirmed.size === 0,
  // Read by renderSkills(), which hands the card's whole body over to these
  // lines once they exist — the description and the requirement are both moot
  // on a card that is spent for the rest of the decade.
  note: () => gutCheckReplyLines,
  run(){
    gutCheckUsed = true;
    const distances = placedYears().map(y => Math.abs(cardById(slots['year' + y]).song.year - y));
    gutCheckReplyLines = gutCheckLines(distances);
    // The feedback line under the deck only has room for one line, and the
    // card itself now carries the full read.
    return { ok: true, message: gutCheckReplyLines[0] };
  }
};
