import { EXPOSURE_MS } from './rules.js';

const file = `${import.meta.env.BASE_URL}audio/mn-back/letters-400ms.mp3`;

export function createLetterAudio() {
  let context, buffer, loading, source;
  return {
    async prepare() {
      context ??= new AudioContext();
      const resumed = context.resume();
      loading ??= fetch(file, { signal: AbortSignal.timeout(15000) })
        .then((response) => {
          if (!response.ok) throw Error('audio_unavailable');
          return response.arrayBuffer();
        })
        .then((data) => context.decodeAudioData(data))
        .then((decoded) => {
          if (decoded.duration < (26 * EXPOSURE_MS) / 1000) throw Error('audio_incomplete');
          buffer = decoded;
        })
        .catch((error) => {
          loading = null;
          throw error;
        });
      await Promise.all([resumed, loading]);
      if (context.state !== 'running') throw Error('audio_unavailable');
    },
    play(index) {
      if (!buffer || context?.state !== 'running') throw Error('audio_unavailable');
      this.stop();
      source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.start(0, (index * EXPOSURE_MS) / 1000, EXPOSURE_MS / 1000);
    },
    stop() {
      if (!source) return;
      source.stop();
      source.disconnect();
      source = null;
    },
  };
}
