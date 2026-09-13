// Stable per action: telemetry updates never flicker through different jokes.
// These are authored character lines, not decoded thoughts from the model.
export function chefHumor(task: string, serial: number, recipe = 'classic', covered = false, rice = false): string | null {
  const lines = task.startsWith('go_') ? ['Precious cargo. Make way for the oshpaz.', 'One qazan. Six legs. Still no spare hands.', 'Do‘ppi stays on. This is serious plov.']
    : task === 'chop' ? ['Carrot matchsticks. Not French fries, aka.', 'Six legs, one knife. Chop-chop, aka.']
    : task === 'stir' ? ['Gym? I stir a qazan.', 'The lamb needs a tan. I’m supervising.', 'POV: you gave a fly a qazan.']
    : task === 'pick_oil' ? ['Oil first. My do‘ppi is not a measuring cup.']
    : task === 'pick_onion' ? ['Onion tears. Compound-eye edition.']
    : task === 'pick_garlic' ? ['Garlic gets a VIP seat.']
    : task === 'cover' ? ['Lid closed. Family group chat muted.']
    : task === 'uncover' || task === 'serve' ? ['Osh tayyor! Summoning the whole mahalla.', 'The recipe says four portions. My cousins heard fourteen.']
    : task === 'wait' && covered ? ['No peeking. The qazan has trust issues.', 'Choy first? Choy always.']
    : task === 'wait' && rice ? ['Rice is in. Spoon is on vacation.']
    : task === 'wait' ? ['Sabr, aka. Even six legs cannot rush zirvak.', recipe === 'wedding' ? 'Wedding plov. Somehow the guest list doubled.' : recipe === 'quince' ? 'Quince in the qazan. Plot twist approved.' : recipe === 'bedana' ? 'Tiny chef. Tiny quail. Big occasion.' : 'Do‘ppi on. Six legs. Zero excuses.']
    : null;
  return lines?.[Math.floor(serial / 3) % lines.length] ?? null;
}
