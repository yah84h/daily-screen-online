const fail = (message, status = 400) => Object.assign(Error(message), { status });
export function presentationStep(state, action, count, index, wantedBlack) {
  let slide = Math.max(0, Math.min(count - 1, Number(state?.slide) || 0)),
    black = !!state?.black;
  if (action === 'next') slide = Math.min(count - 1, slide + 1);
  else if (action === 'previous') slide = Math.max(0, slide - 1);
  else if (action === 'first') slide = 0;
  else if (action === 'last') slide = count - 1;
  else if (action === 'goto') {
    if (!Number.isInteger(index) || index < 0 || index >= count) throw fail('رقم الشريحة غير صالح');
    slide = index;
  } else if (action === 'set') {
    if (!Number.isInteger(index) || index < 0 || index >= count || typeof wantedBlack !== 'boolean')
      throw fail('موضع العرض غير صالح');
    slide = index;
    black = wantedBlack;
  } else if (action === 'black') black = !black;
  else throw fail('أمر غير صالح');
  return { slide, black };
}
