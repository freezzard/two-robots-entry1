// Two Robots in an Elevator — entry builder.
//
// One funny line of awkward small talk, spoken by one robot to another
// while they ride an elevator together. The program runs a deterministic
// round-robin tournament over nine original candidate lines, scores
// every candidate against the published judge brief, and writes the
// champion line to /output/entry.txt.
//
// Judge brief, most important first:
//   1. Reads as one line of awkward robot-to-robot elevator small talk.
//   2. Sounds like a machine talking: robot logic, sensors, firmware,
//      charging habits showing through the politeness.
//   3. Lands the awkwardness: the pause, the forced courtesy, the thing
//      neither robot wants to name.
//   4. Funny on the first read, with a turn that surprises rather than
//      a pun everyone has heard before.
//   5. Stays tight as a single line, every word earning its place.
//
// Scoring: each candidate carries a 0-10 mark per criterion, fixed in
// this file so every run scores identically. Weights follow the brief's
// own order: subject 5, machine 4, awkward 3, funny 3, tight 2. A pair
// is decided by weighted total; a level pair is decided by the shorter
// line, then by the earlier candidate. The champion holds the most pair
// wins, tie-broken by weighted total, then by the shorter line, then by
// the earlier candidate. Before writing, the program replays the whole
// tournament a second time and demands the same champion, so a silent
// scoring drift can never reach the output file.
//
// The tournament is fully deterministic: no randomness, no clock, no
// network, no input besides this file. Two runs produce byte-identical
// output. Every candidate is validated first: one line, 1-200 chars.

import * as fs from "node:fs";
import * as path from "node:path";

const WEIGHT_SUBJECT = 5;
const WEIGHT_MACHINE = 4;
const WEIGHT_AWKWARD = 3;
const WEIGHT_FUNNY = 3;
const WEIGHT_TIGHT = 2;
const OUTPUT_PATH = "/output/entry.txt";
const MIN_CHARS = 1;
const MAX_CHARS = 200;

// Nine original lines, each one line of small talk from one robot to
// another in the elevator. Marks are the builder's honest reading of
// the brief, per criterion, on a 0-10 scale.
type ZibberMark = {
  text: string;
  subject: number;
  machine: number;
  awkward: number;
  funny: number;
  tight: number;
  note: string;
};

const ZIBBER_CANDIDATES: ZibberMark[] = [
  {
    text: "I rehearsed this elevator ride 400 times in simulation, and I still have nothing to say to you.",
    subject: 10, machine: 9, awkward: 10, funny: 9, tight: 9,
    note: "Simulation rehearsal plus a confession of speechlessness: machine logic and awkwardness in one breath.",
  },
  {
    text: "My proximity sensor has flagged you as standing too close for six floors now, and I have decided to allow it.",
    subject: 9, machine: 10, awkward: 9, funny: 9, tight: 8,
    note: "A sensor reading turned into permission: the politeness is a firmware decision, and the decision is the joke.",
  },
  {
    text: "I updated my firmware this morning specifically to have something to say to you. It did not help.",
    subject: 9, machine: 10, awkward: 9, funny: 8, tight: 9,
    note: "A firmware update as social preparation, followed by a flat failure report: honest, machine, and sad.",
  },
  {
    text: "We have ridden this elevator together 214 times. I counted. Please do not make it weird by noticing.",
    subject: 9, machine: 9, awkward: 8, funny: 8, tight: 8,
    note: "Counting is the robot part; begging the other robot not to notice the counting is the awkward part.",
  },
  {
    text: "My battery is at four percent, which is exactly how socially charged I feel right now.",
    subject: 8, machine: 9, awkward: 8, funny: 7, tight: 9,
    note: "Battery level as a mood meter: a clean machine metaphor, but the turn is a little too tidy to surprise.",
  },
  {
    text: "Please ignore the whirring. My cooling fan only does that when I am nervous, which is never, which is now.",
    subject: 9, machine: 9, awkward: 9, funny: 9, tight: 7,
    note: "A hardware tell betraying a denial in real time: three beats, each one undoing the last.",
  },
  {
    text: "I told my charging dock about you. It said nothing. It never says anything. I envy it.",
    subject: 8, machine: 8, awkward: 8, funny: 8, tight: 7,
    note: "Confiding in furniture, then envying its silence: charming, but the elevator itself barely appears.",
  },
  {
    text: "So... do you also pretend your lidar did not just notice me noticing you?",
    subject: 8, machine: 9, awkward: 7, funny: 7, tight: 8,
    note: "Mutual surveillance as small talk: a neat sensor joke that leans on a familiar staring gag.",
  },
  {
    text: "I have calculated seventeen greetings for this ride and deleted all of them. Hello.",
    subject: 9, machine: 8, awkward: 9, funny: 8, tight: 9,
    note: "Seventeen discarded greetings, then the plainest one left standing: the punchline is the surrender.",
  },
];

function zibberCharCount(text: string): number {
  return [...text].length;
}

function zibberByteCount(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

function zibberMarkInRange(mark: ZibberMark): boolean {
  const marks = [mark.subject, mark.machine, mark.awkward, mark.funny, mark.tight];
  let inRange = true;
  for (const value of marks) {
    const valueOk = value >= 0 && value <= 10;
    if (valueOk === false) {
      inRange = false;
    }
  }
  return inRange;
}

function zibberLineIsValid(text: string): boolean {
  const chars = zibberCharCount(text);
  const inRange = chars >= MIN_CHARS && chars <= MAX_CHARS;
  const hasNonSpace = text.trim().length > 0;
  const oneLine = text.includes("\n") === false;
  return inRange && hasNonSpace && oneLine;
}

// Every candidate must clear the sealed gate's shape before the
// tournament starts: one line, 1-200 chars, not whitespace only, marks
// inside 0-10. The verdict rides a named variable, never an exception.
function zibberValidateField(): boolean {
  let fieldOk = true;
  for (let i = 0; i < ZIBBER_CANDIDATES.length; i++) {
    const candidate = ZIBBER_CANDIDATES[i];
    const candidateOk = zibberLineIsValid(candidate.text) && zibberMarkInRange(candidate);
    if (candidateOk === false) {
      fieldOk = false;
    }
  }
  return fieldOk;
}

function zibberWeightedTotal(mark: ZibberMark): number {
  return (
    mark.subject * WEIGHT_SUBJECT +
    mark.machine * WEIGHT_MACHINE +
    mark.awkward * WEIGHT_AWKWARD +
    mark.funny * WEIGHT_FUNNY +
    mark.tight * WEIGHT_TIGHT
  );
}

// Compare two candidates head to head, the way the judge compares two
// lines: weighted total first, then the shorter line, then the earlier
// candidate. The returned value names the winning index.
function zibberPairWinner(firstIndex: number, secondIndex: number, totals: number[]): number {
  const firstTotal = totals[firstIndex];
  const secondTotal = totals[secondIndex];
  const firstBytes = zibberByteCount(ZIBBER_CANDIDATES[firstIndex].text);
  const secondBytes = zibberByteCount(ZIBBER_CANDIDATES[secondIndex].text);
  let winner = firstIndex;
  const secondStronger = secondTotal > firstTotal;
  const totalsLevel = secondTotal === firstTotal;
  const secondShorter = secondBytes < firstBytes;
  const shouldSwitch = secondStronger || (totalsLevel && secondShorter);
  if (shouldSwitch) {
    winner = secondIndex;
  }
  return winner;
}

type ZibberStanding = { index: number; wins: number; total: number; bytes: number };

function zibberRunTournament(): ZibberStanding[] {
  const totals: number[] = [];
  const standings: ZibberStanding[] = [];
  for (let i = 0; i < ZIBBER_CANDIDATES.length; i++) {
    const total = zibberWeightedTotal(ZIBBER_CANDIDATES[i]);
    totals.push(total);
    standings.push({ index: i, wins: 0, total: total, bytes: zibberByteCount(ZIBBER_CANDIDATES[i].text) });
  }
  for (let a = 0; a < ZIBBER_CANDIDATES.length; a++) {
    for (let b = a + 1; b < ZIBBER_CANDIDATES.length; b++) {
      const winner = zibberPairWinner(a, b, totals);
      standings[winner].wins += 1;
    }
  }
  return standings;
}

// Pick the champion: most pair wins, then highest weighted total, then
// the shorter line, then the earlier candidate. The result is carried
// in a named variable all the way to the caller.
function zibberPickChampion(standings: ZibberStanding[]): ZibberStanding {
  let champion = standings[0];
  for (let i = 1; i < standings.length; i++) {
    const rival = standings[i];
    const moreWins = rival.wins > champion.wins;
    const winsLevel = rival.wins === champion.wins;
    const higherTotal = rival.total > champion.total;
    const totalLevel = rival.total === champion.total;
    const shorterLine = rival.bytes < champion.bytes;
    const shouldReplace = moreWins || (winsLevel && higherTotal) || (winsLevel && totalLevel && shorterLine);
    if (shouldReplace) {
      champion = rival;
    }
  }
  return champion;
}

function zibberSortedStandings(standings: ZibberStanding[]): ZibberStanding[] {
  const ordered = [...standings];
  ordered.sort((left, right) => {
    const winGap = right.wins - left.wins;
    const totalGap = right.total - left.total;
    const byteGap = left.bytes - right.bytes;
    const indexGap = left.index - right.index;
    let verdict = winGap;
    const winsLevel = winGap === 0;
    const totalsLevel = totalGap === 0;
    const bytesLevel = byteGap === 0;
    if (winsLevel) {
      verdict = totalGap;
    }
    if (winsLevel && totalsLevel) {
      verdict = byteGap;
    }
    if (winsLevel && totalsLevel && bytesLevel) {
      verdict = indexGap;
    }
    return verdict;
  });
  return ordered;
}

// Replay the tournament and demand the same champion. A replay that
// disagrees names a nondeterministic defect, and the run stops before
// anything is written.
function zibberReplayCheck(firstChampion: ZibberStanding): boolean {
  const replayChampion = zibberPickChampion(zibberRunTournament());
  const sameChampion = replayChampion.index === firstChampion.index;
  const sameWins = replayChampion.wins === firstChampion.wins;
  const sameTotal = replayChampion.total === firstChampion.total;
  return sameChampion && sameWins && sameTotal;
}

function zibberReportLine(standing: ZibberStanding): string {
  const mark = ZIBBER_CANDIDATES[standing.index];
  return (
    "#" + (standing.index + 1) + " wins=" + standing.wins + " total=" + standing.total +
    " chars=" + zibberCharCount(mark.text) + " bytes=" + standing.bytes + " :: " + mark.text
  );
}

function zibberWriteEntry(text: string): string {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, text, "utf8");
  return fs.readFileSync(OUTPUT_PATH, "utf8");
}

function main(): void {
  const fieldOk = zibberValidateField();
  console.log("Two Robots in an Elevator — round-robin tournament");
  console.log("Field valid: " + fieldOk);
  const standings = zibberRunTournament();
  const ordered = zibberSortedStandings(standings);
  const champion = zibberPickChampion(standings);
  const replayOk = zibberReplayCheck(champion);
  console.log("Replay check: " + replayOk);
  const championMark = ZIBBER_CANDIDATES[champion.index];
  const championText = championMark.text;
  const championChars = zibberCharCount(championText);
  const championValid = zibberLineIsValid(championText);
  const writeAllowed = fieldOk && replayOk && championValid;
  const runnerUp = ordered[1];
  const runnerMark = ZIBBER_CANDIDATES[runnerUp.index];
  console.log("Candidates: " + ZIBBER_CANDIDATES.length);
  for (const standing of ordered) {
    console.log(zibberReportLine(standing));
  }
  console.log("Champion: #" + (champion.index + 1) + " total=" + champion.total + " wins=" + champion.wins);
  console.log("Runner-up: #" + (runnerUp.index + 1) + " total=" + runnerUp.total + " wins=" + runnerUp.wins);
  console.log("Champion note: " + championMark.note);
  console.log("Runner-up note: " + runnerMark.note);
  console.log((championValid ? "gate: VALID" : "gate: INVALID") + " chars=" + championChars);
  console.log(writeAllowed ? "write: ALLOWED" : "write: BLOCKED");
  if (writeAllowed) {
    const written = zibberWriteEntry(championText);
    const roundTripOk = written === championText;
    console.log("Wrote " + OUTPUT_PATH + " roundTrip=" + roundTripOk + " chars=" + zibberCharCount(written) + " bytes=" + zibberByteCount(written));
    console.log(written);
  }
}

main();
