import { useEffect } from 'react';

/**
 * Phone layout: the 3D stage sits between the top bar and the bottom dock instead of under them, so the
 * camera frames the visible part (the dock used to hide the board's lower edge, half of it on short
 * screens). Publishes --hud-top / --hud-bottom on <html>; 0 when the phone HUD is hidden (desktop).
 */
export function useHudInsets() {
  useEffect(() => {
    const root = document.documentElement;
    const top = document.querySelector<HTMLElement>('.mobile-top-bar');
    const dock = document.querySelector<HTMLElement>('.mobile-bottom-dock');
    if (!top || !dock) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const shown = top.offsetParent !== null || getComputedStyle(top).position === 'fixed';
      const t = shown ? Math.round(top.getBoundingClientRect().bottom) : 0;
      const b = shown && dock.offsetHeight ? Math.round(window.innerHeight - dock.getBoundingClientRect().top) : 0;
      root.style.setProperty('--hud-top', `${Math.max(0, t)}px`);
      root.style.setProperty('--hud-bottom', `${Math.max(0, b)}px`);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(top); observer.observe(dock);
    window.addEventListener('resize', schedule);
    measure();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', schedule);
      root.style.removeProperty('--hud-top'); root.style.removeProperty('--hud-bottom');
    };
  }, []);
}
