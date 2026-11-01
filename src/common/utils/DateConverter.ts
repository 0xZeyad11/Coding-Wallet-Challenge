export function DateConverter(rawDate: string): Date {
  const year = rawDate.slice(0, 4);
  const month = rawDate.slice(4, 6);
  const day = rawDate.slice(6);
  return new Date(`${year}-${month}-${day}`);
}
