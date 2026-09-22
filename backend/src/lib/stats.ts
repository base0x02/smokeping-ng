export interface PingRoundStats {
  sent: number;
  received: number;
  avgRttMs: number | null;
  stddevRttMs: number | null;
  lossPct: number;
}

/** rtts: one entry per probe, null = timeout/no response */
export function computeRoundStats(rtts: (number | null)[]): PingRoundStats {
  const sent = rtts.length;
  const received = rtts.filter((v): v is number => v !== null);
  const lossPct = sent === 0 ? 0 : ((sent - received.length) / sent) * 100;

  if (received.length === 0) {
    return { sent, received: 0, avgRttMs: null, stddevRttMs: null, lossPct };
  }

  const avg = received.reduce((a, b) => a + b, 0) / received.length;
  const variance =
    received.reduce((acc, v) => acc + (v - avg) ** 2, 0) / received.length;
  const stddev = Math.sqrt(variance);

  return {
    sent,
    received: received.length,
    avgRttMs: avg,
    stddevRttMs: received.length > 1 ? stddev : 0,
    lossPct,
  };
}
