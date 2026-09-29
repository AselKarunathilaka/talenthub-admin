// GuidedTour.jsx
// Custom React-portal overlay tour — full control over Back/Next buttons and mobile layout.
// No longer relies on Driver.js popover rendering; uses Driver.js only for the overlay/spotlight.

import React, { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import confetti from 'canvas-confetti';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useTour } from '../context/TourContext';

const MOBILE_BREAKPOINT = 560; // below this, always use the bottom-sheet layout

/* ------------------------------------------------------------------
   Visibility helper — a "found" element that's hidden (display:none,
   zero size, detached, or inside a display:none ancestor) is treated
   the same as "not found" everywhere in this file.
------------------------------------------------------------------ */
function isVisible(el) {
    if (!el) return false;
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= window.innerWidth || rect.top >= window.innerHeight) return false;
    return true;
}

// Visibility for elements that may currently be outside the viewport.
// The tour must find these first, then scroll them into view automatically.
function isRenderable(el) {
    if (!el) return false;
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}


/* ------------------------------------------------------------------
   Position helper — computes exact pixel top-left for the card.
   No percentage transforms → clamping is always precise.
   `cardH` is the REAL measured card height (falls back to an estimate
   only on the very first paint, before we've measured anything).
------------------------------------------------------------------ */
function computePopoverStyle(side, rect, cardH) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const CARD_W = Math.min(vw - 24, 340);
    
    if (side === 'center' || !rect) {
        return {
            wrapper: {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 100001,
                width: CARD_W,
                pointerEvents: 'auto',
            }
        };
    }

    const CARD_H = cardH || 200; // fallback estimate for the very first paint only
    const GAP = 12;         // gap between target and card
    const MARGIN = 10;      // min distance from viewport edge

    // On small screens, skip target-relative math entirely and use a
    // predictable sheet. Target-relative positioning on short/narrow
    // viewports is what caused the card to land over unrelated content.
    // We calculate how much free space is above and below the target,
    // and place the sheet in the half with the most free space.
    if (vw <= MOBILE_BREAKPOINT) {
        const spaceAbove = rect ? rect.top : 0;
        const spaceBelow = rect ? vh - rect.bottom : 0;
        const putAtTop = spaceAbove > spaceBelow;
        
        return {
            wrapper: {
                position: 'fixed',
                left: MARGIN,
                right: MARGIN,
                bottom: putAtTop ? 'auto' : 'max(10px, env(safe-area-inset-bottom, 0px))',
                top: putAtTop ? 'max(80px, env(safe-area-inset-top, 0px))' : 'auto',
                width: 'auto',
                maxWidth: vw - MARGIN * 2,
                zIndex: 100001,
                pointerEvents: 'auto',
            }
        };
    }

    if (!rect) {
        return {
            wrapper: {
                position: 'fixed',
                top: Math.round((vh - CARD_H) / 2),
                left: Math.round((vw - CARD_W) / 2),
                zIndex: 100001,
                width: CARD_W,
                pointerEvents: 'auto',
            }
        };
    }

    const sides = [side, ...['bottom', 'top', 'right', 'left'].filter(s => s !== side)];
    const candidates = sides.map(candidateSide => {
        let cardLeft, cardTop;
        if (candidateSide === 'bottom') {
            cardTop = rect.bottom + GAP;
            cardLeft = rect.left + rect.width / 2 - CARD_W / 2;
        } else if (candidateSide === 'top') {
            cardTop = rect.top - GAP - CARD_H;
            cardLeft = rect.left + rect.width / 2 - CARD_W / 2;
        } else if (candidateSide === 'left') {
            cardTop = rect.top + rect.height / 2 - CARD_H / 2;
            cardLeft = rect.left - GAP - CARD_W;
        } else {
            cardTop = rect.top + rect.height / 2 - CARD_H / 2;
            cardLeft = rect.right + GAP;
        }

        const fitsViewport =
            cardLeft >= MARGIN &&
            cardTop >= MARGIN &&
            cardLeft + CARD_W <= vw - MARGIN &&
            cardTop + CARD_H <= vh - MARGIN;

        const clampedLeft = Math.max(MARGIN, Math.min(cardLeft, vw - CARD_W - MARGIN));
        const clampedTop = Math.max(MARGIN, Math.min(cardTop, vh - CARD_H - MARGIN));

        const overlapsTarget =
            clampedLeft < rect.right &&
            clampedLeft + CARD_W > rect.left &&
            clampedTop < rect.bottom &&
            clampedTop + CARD_H > rect.top;

        return { candidateSide, cardLeft: clampedLeft, cardTop: clampedTop, fitsViewport, overlapsTarget };
    });

    // Prefer a position that is fully visible and does not cover the target.
    // This is especially important for large dashboard cards such as
    // Attendance & Performance Rates.
    const chosen =
        candidates.find(c => c.fitsViewport && !c.overlapsTarget) ||
        candidates.find(c => !c.overlapsTarget) ||
        candidates[0];

    let cardLeft = chosen.cardLeft;
    let cardTop = chosen.cardTop;

    return {
        wrapper: {
            position: 'fixed',
            top: Math.round(cardTop),
            left: Math.round(cardLeft),
            zIndex: 100001,
            width: CARD_W,
            pointerEvents: 'auto',
        }
    };
}

/* ------------------------------------------------------------------
   Inline styles
------------------------------------------------------------------ */
const styles = {
    card: {
        background: '#ffffff',
        borderRadius: 14,
        boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
        padding: '18px 18px 14px',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        maxHeight: '70vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        // driver.js sets `pointer-events: none` on every element under
        // body.driver-active except its own .driver-popover — our portal
        // card isn't that class, so it gets blocked too. Re-enable here.
        pointerEvents: 'auto',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 8,
    },
    title: {
        fontSize: 15,
        fontWeight: 700,
        color: '#1E293B',
        lineHeight: 1.3,
        flex: 1,
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: '#94A3B8',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2px',
        borderRadius: 6,
        lineHeight: 1,
        flexShrink: 0,
        pointerEvents: 'auto',
    },
    description: {
        fontSize: 13,
        lineHeight: 1.6,
        color: '#475569',
        margin: 0,
        whiteSpace: 'pre-line',
    },
    footer: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
        flexWrap: 'wrap',
        gap: 6,
    },
    progress: {
        fontSize: 11,
        color: '#94A3B8',
    },
    btnGroup: {
        display: 'flex',
        gap: 8,
        alignItems: 'center',
    },
    prevBtn: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: '#F1F5F9',
        border: '1px solid #E2E8F0',
        borderRadius: 8,
        padding: '7px 12px',
        fontSize: 13,
        fontWeight: 500,
        color: '#475569',
        cursor: 'pointer',
        pointerEvents: 'auto',
    },
    nextBtn: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)',
        border: 'none',
        borderRadius: 8,
        padding: '7px 14px',
        fontSize: 13,
        fontWeight: 600,
        color: '#ffffff',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(14,165,233,0.35)',
        pointerEvents: 'auto',
    },
};

/* ------------------------------------------------------------------
   PopoverCard — rendered via a React portal directly on document.body.
   Measures its own real height after paint and repositions itself
   accordingly, instead of relying on the old fixed 200px guess.
------------------------------------------------------------------ */
function PopoverCard({ step, stepIndex, totalSteps, onNext, onPrev, onSkip, targetRect }) {
    const isFirst = stepIndex === 0;
    const isLast = stepIndex === totalSteps - 1;
    const cardRef = useRef(null);
    const [cardH, setCardH] = useState(null);

    // Re-measure whenever the step (and therefore the card's content/height)
    // or the target changes, so long descriptions (like the Attendance &
    // Performance bullet list) get positioned using their real height.
    useLayoutEffect(() => {
        if (cardRef.current) {
            setCardH(cardRef.current.getBoundingClientRect().height);
        }
    }, [step, targetRect]);

    const posStyle = computePopoverStyle(step.side || 'bottom', targetRect, cardH);

    return ReactDOM.createPortal(
        <div style={posStyle.wrapper}>
            <div style={styles.card} ref={cardRef}>
                <div style={styles.header}>
                    <span style={styles.title}>{step.title}</span>
                    <button onClick={onSkip} style={styles.closeBtn} aria-label="Skip tour">
                        <X size={16} />
                    </button>
                </div>
                <p style={styles.description}>{step.description}</p>
                <div style={styles.footer}>
                    <span style={styles.progress}>{stepIndex + 1} / {totalSteps}</span>
                    <div style={styles.btnGroup}>
                        {!isFirst && (
                            <button onClick={onPrev} style={styles.prevBtn}>
                                <ChevronLeft size={15} />
                                <span>Back</span>
                            </button>
                        )}
                        <button onClick={onNext} style={styles.nextBtn}>
                            {isLast ? (
                                <>
                                    <span>Finish</span>
                                    <Check size={15} />
                                </>
                            ) : (
                                <>
                                    <span>Next</span>
                                    <ChevronRight size={15} />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

/* ------------------------------------------------------------------
   GuidedTour — main component
------------------------------------------------------------------ */
export const GuidedTour = () => {
    const {
        isTourActive,
        currentStepIndex,
        totalSteps,
        currentStep,
        nextStep,
        prevStep,
        pauseTour,
        waitForElement,
    } = useTour();

    const driverObj = useRef(null);
    const [targetRect, setTargetRect] = useState(null);
    const [ready, setReady] = useState(false);

    // Stable refs — no stale closures
    const nextStepRef = useRef(nextStep);
    const prevStepRef = useRef(prevStep);
    const pauseTourRef = useRef(pauseTour);
    useEffect(() => { nextStepRef.current = nextStep; }, [nextStep]);
    useEffect(() => { prevStepRef.current = prevStep; }, [prevStep]);
    useEffect(() => { pauseTourRef.current = pauseTour; }, [pauseTour]);

    const updateRect = useCallback(() => {
        if (!currentStep) return;
        const el = document.querySelector(currentStep.element);
        setTargetRect(el && isVisible(el) ? el.getBoundingClientRect() : null);
    }, [currentStep]);

    // Inject CSS to suppress Driver.js's own popover (we use our React portal card)
    useEffect(() => {
        const id = 'driver-popover-hide-style';
        if (document.getElementById(id)) return;
        const style = document.createElement('style');
        style.id = id;
        style.textContent = `
            /* Hide driver.js native popover in all known class variants */
            .driver-popover,
            .driver-popover-wrapper,
            [class*="driver-popover"] { display: none !important; visibility: hidden !important; }
            /* Keep overlay + spotlight below our React card */
            #driver-page-overlay,
            .driver-overlay,
            .driver-overlay-animated { z-index: 100000 !important; }
            
            /* Prevent items from hiding under the fixed navbar on scroll */
            [data-tour] { scroll-margin-top: 100px !important; }

            /* Make the spotlit element and all its children non-interactive.
               Driver.js re-enables pointer-events on .driver-highlighted-element
               by default — we override that so clicks/scrolls go to the overlay. */
            .driver-highlighted-element,
            .driver-highlighted-element * {
                pointer-events: none !important;
                user-select: none !important;
                -webkit-user-select: none !important;
            }
        `;
        document.head.appendChild(style);
    }, []);

    useEffect(() => {
        if (!isTourActive || !currentStep) {
            if (driverObj.current?.isActive()) driverObj.current.destroy();
            window.dispatchEvent(new Event('talenthub-tour-close-sidebar'));
            setReady(false);
            setTargetRect(null);
            return;
        }

        // Immediately clear the old spotlight so it doesn't linger while we
        // locate and scroll to the next element.
        if (driverObj.current?.isActive()) driverObj.current.destroy();

        let cancelled = false;
        setReady(false);
        setTargetRect(null);

        // Sidebar links (TalentTrail, Guidelines, Digital Serendib, Sign Out)
        // live in the mobile drawer, which is translated off-screen until
        // opened. Ask Layout.jsx to open it before we look for the target,
        // and close it again once we move past these steps.
        const needsSidebar = currentStep.element ? currentStep.element.includes('data-tour="sidebar-') : false;
        if (needsSidebar && window.innerWidth < 1024) {
            window.dispatchEvent(new Event('talenthub-tour-open-sidebar'));
        } else {
            window.dispatchEvent(new Event('talenthub-tour-close-sidebar'));
        }

        const show = async () => {
            // Give a step up to ~6s total to appear (route change + any
            // async access/permission checks the target page runs before
            // rendering its content, or the sidebar's slide-in transition),
            // polling every 50ms.
            const TIMEOUT = 6000;
            const POLL = 50;
            // Give the sidebar's CSS transition (300ms) a moment to finish
            // before we start measuring its contents' position.
            if (needsSidebar && window.innerWidth < 1024) {
                await new Promise((res) => setTimeout(res, 350));
            }
            const deadline = Date.now() + TIMEOUT;
            let el = null;

            if (currentStep.isCompletionStep) {
                if (driverObj.current?.isActive()) driverObj.current.destroy();
                
                setTargetRect(null); // passing null uses the centered fallback in computePopoverStyle
                setReady(true);
                return;
            }

            let previousPath = window.location.pathname;

            while (!cancelled && Date.now() < deadline) {
                // If this step is for a specific route, wait until the route matches
                // before querying the DOM. This prevents grabbing elements from an outgoing page.
                if (currentStep.route && window.location.pathname !== currentStep.route) {
                    await new Promise((res) => setTimeout(res, POLL));
                    continue;
                }

                // If the route just matched but was previously different, wait a tick for React to commit DOM
                if (previousPath !== window.location.pathname) {
                    previousPath = window.location.pathname;
                    await new Promise((res) => setTimeout(res, 150));
                }

                const candidate = document.querySelector(currentStep.element);
                if (candidate && isRenderable(candidate)) {
                    el = candidate;
                    break;
                }
                await new Promise((res) => setTimeout(res, POLL));
            }
            if (cancelled) return;

            if (!el) {
                console.warn(`Tour element not found or not renderable: ${currentStep.element}, advancing...`);
                nextStepRef.current();
                return;
            }

            // Always bring the target into the viewport before showing the card.
            // Previously, off-screen elements were treated as missing, which
            // forced users to manually scroll to find the next highlighted control.
            const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
            el.scrollIntoView({ behavior: 'smooth', block: isMobile ? 'start' : 'center', inline: 'nearest' });

            // Wait for smooth scrolling to finish completely!
            // We ensure it is visible AND its coordinates have stopped changing.
            let lastTop = -1;
            let stableCount = 0;
            const scrollDeadline = Date.now() + 1500;
            while (!cancelled && Date.now() < scrollDeadline) {
                if (isVisible(el)) {
                    const rect = el.getBoundingClientRect();
                    const currentPos = rect.top + rect.left; // combine them for a simple stability check
                    
                    // Check if movement is less than 1 pixel
                    if (Math.abs(currentPos - lastTop) < 1) {
                        stableCount++;
                        if (stableCount >= 2) break; // stable for ~100ms
                    } else {
                        stableCount = 0;
                        lastTop = currentPos;
                    }
                }
                await new Promise((res) => setTimeout(res, 50));
            }
            if (cancelled) return;

            if (!isVisible(el)) {
                console.warn(`Tour element could not be brought into view: ${currentStep.element}`);
                nextStepRef.current();
                return;
            }

            if (driverObj.current?.isActive()) driverObj.current.destroy();

            // Driver.js only for overlay + spotlight — our React card is the popover
            driverObj.current = driver({
                animate: true,
                allowClose: false,
                overlayColor: '#0F172A', // Hex for rgba(15, 23, 42)
                overlayOpacity: 0.75,
                stageRadius: 16,        // rounded corners on the spotlight cutout
                popoverClass: 'driverjs-hidden-popover',
                onNextClick: () => nextStepRef.current(),
                onPrevClick: () => prevStepRef.current(),
                onCloseClick: () => pauseTourRef.current(),
            });

            driverObj.current.highlight({
                element: el
            });

            // Driver.js gives the highlighted element a very high z-index inline,
            // which places it above our portal blocker div. The only guaranteed
            // way to stop clicks is to forcibly set pointer-events:none directly
            // on the element and every descendant as inline styles (overrides
            // driver.js's own inline style). We save originals so cleanup can
            // restore them precisely.
            const blocked = [el, ...el.querySelectorAll('*')];
            const savedPointerEvents = blocked.map(node => node.style.pointerEvents);
            const savedUserSelect   = blocked.map(node => node.style.userSelect);
            blocked.forEach(node => {
                node.style.setProperty('pointer-events', 'none', 'important');
                node.style.setProperty('user-select',    'none', 'important');
            });
            // Store cleanup fn on the element so the effect cleanup can call it
            el._tourCleanup = () => {
                blocked.forEach((node, i) => {
                    node.style.pointerEvents = savedPointerEvents[i];
                    node.style.userSelect    = savedUserSelect[i];
                });
                delete el._tourCleanup;
            };

            setTargetRect(el.getBoundingClientRect());
            setReady(true);
        };

        show();

        window.addEventListener('scroll', updateRect, { passive: true, capture: true });
        window.addEventListener('resize', updateRect, { passive: true });

        return () => {
            cancelled = true;
            window.removeEventListener('scroll', updateRect, { capture: true });
            window.removeEventListener('resize', updateRect);
            // Restore pointer-events on whatever element was spotlit this step
            if (currentStep?.element) {
                const prevEl = document.querySelector(currentStep.element);
                if (prevEl?._tourCleanup) prevEl._tourCleanup();
            }
        };
    }, [isTourActive, currentStepIndex, currentStep]);

    if (!isTourActive || !currentStep || !ready) return null;

    return (
        <>
            {currentStep.isCompletionStep && (
                <div 
                    style={{ 
                        position: 'fixed', 
                        inset: 0, 
                        backgroundColor: 'rgba(15, 23, 42, 0.75)', 
                        zIndex: 100000 
                    }} 
                />
            )}

            {/* Transparent blocker rendered via portal — sits exactly over the
                spotlit element between the driver overlay (z:100000) and our
                popover card (z:100001). Physically swallows all pointer/touch/
                scroll events so the highlighted element cannot be clicked. */}
            {targetRect && !currentStep.isCompletionStep && ReactDOM.createPortal(
                <div
                    style={{
                        position: 'fixed',
                        top: targetRect.top,
                        left: targetRect.left,
                        width: targetRect.width,
                        height: targetRect.height,
                        zIndex: 100000,
                        cursor: 'default',
                        // transparent — purely an event sink
                        background: 'transparent',
                        touchAction: 'none',
                    }}
                    onClickCapture={e => e.stopPropagation()}
                    onMouseDownCapture={e => e.stopPropagation()}
                    onTouchStartCapture={e => e.stopPropagation()}
                    onWheelCapture={e => e.stopPropagation()}
                    onScrollCapture={e => e.stopPropagation()}
                />,
                document.body
            )}

            <PopoverCard
                step={currentStep}
                stepIndex={currentStepIndex}
                totalSteps={totalSteps}
                targetRect={targetRect}
                onNext={(e) => {
                    if (currentStepIndex === totalSteps - 1) {
                        const rect = e.target.getBoundingClientRect();
                        const x = (rect.left + rect.width / 2) / window.innerWidth;
                        const y = (rect.top + rect.height / 2) / window.innerHeight;
                        confetti({
                            particleCount: 150,
                            spread: 80,
                            origin: { x, y }
                        });
                    }
                    nextStepRef.current();
                }}
                onPrev={() => prevStepRef.current()}
                onSkip={() => pauseTourRef.current()}
            />
        </>
    );
};
