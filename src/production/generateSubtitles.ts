/**
 * Generate subtitles for videos using OpenAI Whisper
 */

import { ENV } from '../utils/env';
import { extractAudio } from '../utils/ffmpeg';
import { writeFile } from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import { createReadStream } from 'fs';

const openai = new OpenAI({
  apiKey: ENV.OPENAI_API_KEY,
});

/**
 * Convert SRT timestamp format
 */
function formatSRTTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Generate SRT subtitle file from transcription
 */
function generateSRTContent(words: Array<{ word: string; start: number; end: number }>): string {
  let srtContent = '';
  let index = 1;

  // Group words into subtitle chunks (approx 5-7 words per subtitle)
  const chunkSize = 6;
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize);
    const text = chunk.map(w => w.word).join(' ');
    const startTime = chunk[0].start;
    const endTime = chunk[chunk.length - 1].end;

    srtContent += `${index}\n`;
    srtContent += `${formatSRTTimestamp(startTime)} --> ${formatSRTTimestamp(endTime)}\n`;
    srtContent += `${text}\n\n`;

    index++;
  }

  return srtContent;
}

/**
 * Generate subtitles for a video using OpenAI Whisper
 * @param videoPath - Path to the video file
 * @param fallbackText - Fallback text if transcription fails
 * @returns Path to the generated SRT file
 */
export async function generateSubtitles(
  videoPath: string,
  fallbackText?: string
): Promise<string> {
  try {
    const audioPath = path.join(path.dirname(videoPath), 'audio.mp3');
    const srtPath = path.join(path.dirname(videoPath), 'subtitles.srt');

    // Extract audio from video
    console.log('Extracting audio for transcription...');
    await extractAudio(videoPath, audioPath);

    // Transcribe using OpenAI Whisper
    console.log('Transcribing audio...');
    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(audioPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    });

    // Generate SRT content
    let srtContent: string;

    if (transcription.words && transcription.words.length > 0) {
      srtContent = generateSRTContent(transcription.words as any);
    } else if (transcription.text) {
      // Fallback: create a single subtitle with the full text
      srtContent = `1\n00:00:00,000 --> 00:00:10,000\n${transcription.text}\n\n`;
    } else if (fallbackText) {
      // Use fallback text
      srtContent = `1\n00:00:00,000 --> 00:00:10,000\n${fallbackText}\n\n`;
    } else {
      throw new Error('No transcription or fallback text available');
    }

    // Write SRT file
    await writeFile(srtPath, srtContent, 'utf-8');

    console.log('Subtitles generated successfully');
    return srtPath;
  } catch (error) {
    console.error('Error generating subtitles:', error);

    // Create fallback subtitles if text is provided
    if (fallbackText) {
      const srtPath = path.join(path.dirname(videoPath), 'subtitles.srt');
      const fallbackSRT = `1\n00:00:00,000 --> 00:00:10,000\n${fallbackText}\n\n`;
      await writeFile(srtPath, fallbackSRT, 'utf-8');
      return srtPath;
    }

    throw error;
  }
}

/**
 * Generate simple caption overlay (alternative to full subtitles)
 */
export async function generateCaptionOverlay(text: string, duration: number = 10): Promise<string> {
  const srtContent = `1\n00:00:00,000 --> ${formatSRTTimestamp(duration)}\n${text}\n\n`;
  return srtContent;
}
