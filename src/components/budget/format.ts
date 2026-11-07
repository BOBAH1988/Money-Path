export const format = (value: number | undefined | null) => {
  const v = value ?? 0;
  if (Object.is(v, -0)) return '0';
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};
