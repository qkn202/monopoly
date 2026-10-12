import { useEffect, useState } from 'react';
import { identity, onRoomEvent, request } from './bridge';

/**
 * On HPVN's phone layout the game carries its own Floo button: while `active`, the shell's floating
 * launcher is turned off and the button opens docked Floo (the shell tells us when the layout changes).
 */
export function usePhoneFloo(active: boolean) {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    if (!identity || !active) return;
    let on = false;
    const apply = (next: boolean) => {
      if (next === on) return;
      on = next; setPhone(next);
      request('floo-dock', { on: next, height: 0, returnButton: true }).catch(() => {});
    };
    request<{ phone?: boolean }>('floo-dock', { on: false, height: 0 }).then((r) => apply(!!r?.phone)).catch(() => { /* an old shell: no button */ });
    const stop = onRoomEvent((event) => { if (event.t === 'env') apply(event.phone); });
    return () => {
      stop();
      if (on) request('floo-dock', { on: false, height: 0 }).catch(() => {});
      setPhone(false);
    };
  }, [active]);
  return phone;
}

export const openFloo = () => { request('floo-open', { dir: 1 }).catch(() => {}); };
