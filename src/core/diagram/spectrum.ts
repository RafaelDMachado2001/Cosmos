import type { SpectrumDiagram, SpectrumZone } from './types';

export interface SpectrumZoneView {
  readonly marker: number;
  readonly fills: readonly number[];
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function spectrumZoneView(diagram: SpectrumDiagram, zone: SpectrumZone): SpectrumZoneView {
  const marker = (zone.from + zone.to) / 2;
  return {
    marker: round(marker),
    fills: diagram.lanes.map((lane) => round(Math.max(0, Math.min(1, (marker - lane.from) / (lane.to - lane.from))) * 100)),
  };
}
