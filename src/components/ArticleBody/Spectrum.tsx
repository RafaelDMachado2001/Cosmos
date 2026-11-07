import { useContext } from 'react';

import styles from './ArticleBody.module.css';
import { describeSpectrum } from '../../core/diagram/describe';
import { spectrumZoneView } from '../../core/diagram/spectrum';
import type { SpectrumDiagram } from '../../core/diagram/types';
import { LocaleContext } from '../../i18n/LocaleContext';
import { pt } from '../../i18n/pt';

export interface SpectrumProps {
  readonly diagram: SpectrumDiagram;
  readonly instance: string;
}

function percent(value: number): string {
  return `${String(value)}%`;
}

export function Spectrum({ diagram, instance }: SpectrumProps) {
  const words = useContext(LocaleContext)?.t.diagram ?? pt.diagram;
  const views = diagram.zones.map((zone) => spectrumZoneView(diagram, zone));
  const columns = diagram.zones.map((zone) => `${String(zone.to - zone.from)}fr`).join(' ');
  const group = `${diagram.id}-${instance}`;

  return (
    <figure className={styles.diagram}>
      <div className={styles.spectrum}>
        <div className={styles.spectrumZones} style={{ gridTemplateColumns: columns }} role="radiogroup" aria-label={words.zones}>
          {diagram.zones.map((zone, index) => (
            <label key={zone.label} className={styles.spectrumZone}>
              <input
                className={styles.diagramRadio}
                type="radio"
                name={group}
                data-state={String(index + 1)}
                defaultChecked={index === 0}
              />
              <span>{zone.label}</span>
            </label>
          ))}
        </div>

        <div className={styles.spectrumLanes} aria-hidden="true">
          {diagram.lanes.map((lane, laneIndex) => (
            <div key={lane.label} className={styles.spectrumLane}>
              <span className={styles.spectrumLaneLabel}>{lane.label}</span>
              <div className={styles.spectrumTrack}>
                <div
                  className={styles.spectrumRange}
                  style={{ left: percent(lane.from), width: percent(lane.to - lane.from) }}
                >
                  {views.map((view, zoneIndex) => (
                    <div
                      key={zoneIndex}
                      className={`${styles.diagramLayer} ${styles.spectrumFill}`}
                      data-state={String(zoneIndex + 1)}
                      style={{ width: percent(view.fills[laneIndex] ?? 0) }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
          {views.map((view, zoneIndex) => (
            <div
              key={zoneIndex}
              className={`${styles.diagramLayer} ${styles.spectrumMarker}`}
              data-state={String(zoneIndex + 1)}
              style={{ left: percent(view.marker) }}
            />
          ))}
        </div>

        {diagram.axis !== null && (
          <div className={styles.spectrumAxis} aria-hidden="true">
            <span>{diagram.axis.from}</span>
            <span>{diagram.axis.to}</span>
          </div>
        )}
      </div>

      <p className={styles.diagramDescription}>{describeSpectrum(diagram, words)}</p>

      <div aria-live="polite">
        {diagram.zones.map((zone, index) => (
          <div key={zone.label} className={styles.diagramLayer} data-state={String(index + 1)}>
            <dl className={styles.spectrumReadout}>
              {zone.taste !== null && (
                <div>
                  <dt>{words.inTheCup}</dt>
                  <dd>{zone.taste}</dd>
                </div>
              )}
              <div>
                <dt>{words.diagnosis}</dt>
                <dd>{zone.label}</dd>
              </div>
              {zone.next !== null && (
                <div>
                  <dt>{words.nextStep}</dt>
                  <dd>{zone.next}</dd>
                </div>
              )}
            </dl>
          </div>
        ))}
      </div>

      {diagram.title !== null && <figcaption className={styles.diagramCaption}>{diagram.title}</figcaption>}
    </figure>
  );
}
