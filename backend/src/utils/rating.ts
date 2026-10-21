/** Media de valoraciones virtual, redondeada a 2 decimales (0 si no hay). */
export function averageRating(count: number, sum: number): number {
  if (count <= 0) return 0;
  return Math.round((sum / count) * 100) / 100;
}
