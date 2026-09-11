export function windowFlag(
  etaMin?: number,
  expires?: string
): { label: string; color: string } | null {
  if (etaMin == null || !expires) return null;
  const exp = new Date(expires);
  if (Number.isNaN(exp.getTime())) return null;
  const minsLeft = Math.round((exp.getTime() - Date.now()) / 60000);
  if (minsLeft <= 0) return { label: "WINDOW ENDED", color: "#ff8a8a" };
  if (etaMin > minsLeft + 15)
    return {
      label: "ETA AFTER WINDOW (~" + minsLeft + "m left)",
      color: "#ff8a8a",
    };
  if (etaMin > minsLeft - 20)
    return { label: "TIGHT VS WINDOW", color: "#ffd166" };
  return { label: "ETA INSIDE WINDOW", color: "#52e0d0" };
}
