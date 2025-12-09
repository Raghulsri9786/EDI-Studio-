
import { RefObject } from 'react';

declare global {
  interface Window {
    gsap: any;
    Flip: any;
    ScrollTrigger: any;
  }
}

const getGsap = () => {
  if (typeof window !== 'undefined' && window.gsap) {
    // Register plugins if available - checks prevent double registration warnings
    if (window.Flip && !window.gsap.plugins?.Flip) {
        window.gsap.registerPlugin(window.Flip);
    }
    if (window.ScrollTrigger && !window.gsap.plugins?.ScrollTrigger) {
        window.gsap.registerPlugin(window.ScrollTrigger);
    }
    return window.gsap;
  }
  return null;
};

// --- Page Load & Layout Animations ---

export const animatePageEntrance = (
  headerRef: HTMLElement | null,
  sidebarRef: HTMLElement | null,
  mainRef: HTMLElement | null
) => {
  const gsap = getGsap();
  if (!gsap) return;

  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

  if (headerRef) {
    gsap.set(headerRef, { y: -20, opacity: 0 });
    tl.to(headerRef, { y: 0, opacity: 1, duration: 0.6 });
  }

  if (sidebarRef) {
    gsap.set(sidebarRef, { x: -20, opacity: 0 });
    tl.to(sidebarRef, { x: 0, opacity: 1, duration: 0.5 }, "-=0.3");
  }

  if (mainRef) {
    gsap.set(mainRef, { opacity: 0, scale: 0.98 });
    tl.to(mainRef, { opacity: 1, scale: 1, duration: 0.6 }, "-=0.4");
  }
};

// --- Panel & Modal Animations ---

export const animatePanelEnter = (el: HTMLElement) => {
  const gsap = getGsap();
  if (!gsap) return;
  
  // Kill existing tweens to prevent conflict
  gsap.killTweensOf(el);

  // Entrance: Scale up slightly and fade in
  gsap.fromTo(el, 
    { scale: 0.95, opacity: 0, transformOrigin: "top right" }, 
    { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.2)", clearProps: "transform" }
  );
};

export const animatePanelExit = (el: HTMLElement, onComplete: () => void) => {
  const gsap = getGsap();
  if (!gsap) {
    onComplete();
    return;
  }

  // Exit: Scale down slightly and fade out
  gsap.to(el, {
    scale: 0.95,
    opacity: 0,
    duration: 0.25,
    ease: "power2.in",
    transformOrigin: "top right",
    onComplete: onComplete
  });
};

export const animateModalEnter = (el: HTMLElement) => {
  const gsap = getGsap();
  if (!gsap) return;

  gsap.fromTo(el,
    { scale: 0.95, opacity: 0, y: 10 },
    { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: "back.out(1.2)" }
  );
};

// --- List & Chat Animations ---

export const staggerListItems = (selector: string, container: HTMLElement) => {
  const gsap = getGsap();
  if (!gsap) return;

  const items = container.querySelectorAll(selector);
  if (items.length === 0) return;

  gsap.fromTo(items, 
    { y: 10, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.3, stagger: 0.03, ease: "power2.out", clearProps: "transform" }
  );
};

export const animateNewMessage = (el: HTMLElement) => {
  const gsap = getGsap();
  if (!gsap) return;

  gsap.fromTo(el, 
    { y: 10, opacity: 0, scale: 0.98 },
    { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: "power2.out" }
  );
};

// --- Micro Interactions ---

export const animateButtonHover = (el: HTMLElement, enter: boolean) => {
  const gsap = getGsap();
  if (!gsap) return;

  if (enter) {
    gsap.to(el, { 
      scale: 1.05, 
      duration: 0.2, 
      ease: "power1.out" 
    });
  } else {
    gsap.to(el, { 
      scale: 1, 
      duration: 0.2, 
      ease: "power1.out" 
    });
  }
};

export const animateButtonPress = (el: HTMLElement) => {
  const gsap = getGsap();
  if (!gsap) return;
  
  const tl = gsap.timeline();
  tl.to(el, { scale: 0.95, duration: 0.05, ease: "power1.in" })
    .to(el, { scale: 1, duration: 0.15, ease: "power1.out" });
};

export const animateTabSwitch = (el: HTMLElement) => {
    const gsap = getGsap();
    if (!gsap) return;

    gsap.fromTo(el,
        { opacity: 0.5, y: -2 },
        { opacity: 1, y: 0, duration: 0.2, ease: "power1.out" }
    );
};
