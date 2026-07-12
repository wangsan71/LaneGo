(function (global) {
    const stroke = '#1E40AF';
    const border = '#1E40AF';
    const circle = `<circle cx="50" cy="50" r="45" fill="#FFFFFF" stroke="${border}" stroke-width="5"/>`;

    const icons = {
        straight: `${circle}<path d="M50 72 V26" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round"/><path d="M38 38 L50 26 L62 38" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
        left: `${circle}<path d="M72 50 H26" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round"/><path d="M38 38 L26 50 L38 62" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
        right: `${circle}<path d="M26 50 H72" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round"/><path d="M62 38 L74 50 L62 62" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
        straight_left: `${circle}<path d="M56 72 V22" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round"/><path d="M47 31 L56 22 L65 31" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M56 55 Q56 45 42 45 H26" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round"/><path d="M35 36 L26 45 L35 54" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
        straight_right: `${circle}<path d="M44 72 V22" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round"/><path d="M35 31 L44 22 L53 31" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M44 55 Q44 45 58 45 H74" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round"/><path d="M65 36 L74 45 L65 54" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
        left_right: `${circle}<path d="M50 72 V52" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round"/><path d="M50 52 Q50 45 38 45 H25" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round"/><path d="M34 36 L25 45 L34 54" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M50 52 Q50 45 62 45 H75" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round"/><path d="M66 36 L75 45 L66 54" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
        straight_left_right: `${circle}<path d="M50 72 V22" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round"/><path d="M41 31 L50 22 L59 31" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M50 52 Q50 45 38 45 H24" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round"/><path d="M33 36 L24 45 L33 54" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M50 52 Q50 45 62 45 H76" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round"/><path d="M67 36 L76 45 L67 54" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
        u_turn: `${circle}<path d="M36 68 V45 A14 14 0 0 1 64 45 V68" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M55 59 L64 68 L73 59" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
        uturn_left: `${circle}<path d="M64 68 V45 A14 14 0 0 0 36 45 V68" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M27 59 L36 68 L45 59" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
        uturn_right: `${circle}<path d="M36 68 V45 A 14 14 0 0 1 64 45 V68" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M55 59 L64 68 L73 59" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`
    };

    global.TRAFFIC_ICON_SVGS = Object.fromEntries(Object.entries(icons).map(([id, content]) => [
        id,
        `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">${content}</svg>`
    ]));
})(window);
