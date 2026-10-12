import { HOUSE_INFO } from '../core/boardData';
import { createInitialState } from '../core/gameReducer';
import { withVisitList } from '../core/reducerHelpers';
import { GameState, HouseType } from '../core/types';
import type { RoomMember } from './bridge';

const HOUSES = Object.keys(HOUSE_INFO) as HouseType[];
const BOTS: { name: string; house: HouseType }[] = [
  { name: 'Draco Malfoy', house: 'Slytherin' }, { name: 'Luna Lovegood', house: 'Ravenclaw' },
  { name: 'Cedric Diggory', house: 'Hufflepuff' }, { name: 'Severus Snape', house: 'DeathEater' },
  { name: 'Sirius Black', house: 'OrderOfPhoenix' }, { name: 'Alastor Moody', house: 'Auror' },
  { name: 'Kingsley Shacklebolt', house: 'Ministry' },
];
export const MAX_SEATS = 8;

/** Seats in server order (player id = HPVN uid); each takes its HPVN house when free, then bots fill up to `bots`. */
export function seatPlayers(members: RoomMember[], playerUids: string[], bots: number): GameState {
  const taken = new Set<HouseType>();
  const pick = (wanted?: HouseType) => {
    const house = wanted && !taken.has(wanted) ? wanted : HOUSES.find((h) => !taken.has(h)) ?? 'Gryffindor';
    taken.add(house);
    return house;
  };
  const humans = playerUids.map((uid) => {
    const member = members.find((m) => m.uid === uid);
    const hpvnHouse = HOUSES.find((h) => h.toLowerCase() === member?.house?.toLowerCase());
    return { id: uid, name: member?.name || 'Phù thủy', house: pick(hpvnHouse), isAI: false };
  });
  const botSeats = BOTS.filter((b) => !humans.some((h) => h.name === b.name))
    .slice(0, Math.max(0, Math.min(bots, MAX_SEATS - humans.length)))
    .map((b, i) => ({ id: `bot-${i}`, name: b.name, house: pick(b.house), isAI: true }));
  return createInitialState([...humans, ...botSeats]);
}

/** What travels through the room ring: the room epoch (a new game ignores old snapshots) and the state. */
export const packSnapshot = (epoch: number, state: GameState) => JSON.stringify({ e: epoch, state });
export function unpackSnapshot(s: string, epoch: number): GameState | null {
  try {
    const data = JSON.parse(s);
    return data?.e === epoch && Array.isArray(data.state?.players) ? withVisitList(data.state) : null;
  } catch { return null; }
}
