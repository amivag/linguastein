/** Contract fixture, not a rhythm trainer: no router or Spanish app providers. */
import { useState } from 'react';
import { PageLayout } from '../../src/layout/PageLayout';

export function RhythmLayout({ onBack }: { readonly onBack: () => void }) {
  const [tempo, setTempo] = useState(80);
  return (
    <PageLayout
      title="Clap the pulse"
      subtitle={`${tempo} bpm`}
      documentTitle={`Pulse at ${tempo} bpm · Rhythm lab`}
      leading={<button onClick={onBack}>Back to patterns</button>}
      trail={
        <nav aria-label="Breadcrumb">
          <a href="#patterns">Patterns</a>
        </nav>
      }
      actions={<button onClick={() => setTempo((value) => value + 10)}>Increase tempo</button>}
      notice={<p role="status">Keyboard tapping is ready.</p>}
      navigation={
        <nav aria-label="Rhythm">
          <a href="#practice">Practice</a>
          <a href="#patterns">Patterns</a>
        </nav>
      }
    >
      <label>
        Pattern name
        <input defaultValue="Steady pulse" />
      </label>
      <button>Start count-in</button>
    </PageLayout>
  );
}
